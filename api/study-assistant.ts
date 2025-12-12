import { GoogleGenAI } from "@google/genai";
import crypto from 'crypto';
import * as admin from 'firebase-admin';
import { Buffer } from 'buffer';
import { rateLimitExceeded } from '../lib/rateLimit';

export const config = {
  runtime: "nodejs",
};

// --- SECURITY CONFIGURATION ---

// 1. ALLOWED ORIGINS (Strict Whitelist)
const ALLOWED_ORIGINS = new Set(
  [
    'http://localhost:5173',
    'http://localhost:3000',
    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '',
  ].filter(Boolean) as string[]
);

function getValidatedOrigin(origin?: string | string[]) {
  const o = Array.isArray(origin) ? origin[0] : origin;
  if (!o) return null;
  return ALLOWED_ORIGINS.has(o) ? o : null;
}

// 2. PAYLOAD LIMITS
const MAX_BODY_SIZE = 200 * 1024; // 200KB

// --- HELPER: Normalize AI Response ---
function normalizeAiResponse(res: any): string {
  if (!res) return '';
  if (typeof res === 'string') return res;
  if (res.text) return res.text; // Standard @google/genai shape
  if (res.outputText) return res.outputText; // Legacy/Alternative shape
  
  // Handle Candidates array
  if (Array.isArray(res.candidates) && res.candidates[0]) {
    return res.candidates[0].content?.parts?.[0]?.text ?? '';
  }
  
  return '';
}

// --- FIREBASE ADMIN INIT ---
if (!admin.apps.length) {
    const projectId = process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY;

    if (projectId && clientEmail && privateKey) {
      try {
        admin.initializeApp({
          credential: admin.credential.cert({
            projectId,
            clientEmail,
            privateKey: privateKey.replace(/\\n/g, '\n'),
          }),
        });
      } catch (e) {
        console.error('Firebase Admin Init Error:', e);
      }
    } else {
      console.error('Firebase Admin Init Error: Missing FIREBASE_PROJECT_ID/FIREBASE_CLIENT_EMAIL/FIREBASE_PRIVATE_KEY');
    }
}

// --- HANDLER ---

interface VercelRequest {
  headers: { [key: string]: string | string[] | undefined };
  method: string;
  body: any; 
}

interface VercelResponse {
  setHeader: (key: string, value: string) => void;
  status: (code: number) => VercelResponse;
  json: (data: any) => void;
  end: () => void;
}

interface StudyContext {
  subject: string;
  topic: string;
  difficultyLevel: 'beginner' | 'intermediate' | 'advanced';
  previousInteractions: string[];
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const requestId = crypto.randomUUID();

  // Prevent caching of authenticated AI responses
  res.setHeader('Cache-Control', 'no-store');
  
  // 1. ORIGIN VALIDATION
  const originHeader = req.headers.origin;
  const validatedOrigin = getValidatedOrigin(originHeader);

  if (originHeader && !validatedOrigin) {
     console.warn(`[${requestId}] Blocked request from unauthorized origin: ${originHeader}`);
     return res.status(403).json({ error: "Forbidden Origin" });
  }

  if (validatedOrigin) {
    res.setHeader('Access-Control-Allow-Origin', validatedOrigin);
    res.setHeader('Vary', 'Origin');
  }
  
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Content-Length');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // 3. IP EXTRACTION
  const xff = req.headers['x-forwarded-for'];
  const rawIp = Array.isArray(xff) ? xff[0] : xff || '';
  const ip = rawIp.split(',')[0].trim() || 'unknown-ip';

  try {
    // 4. CONTENT TYPE & SIZE CHECKS
    const contentTypeHeader = req.headers['content-type'];
    const contentType = Array.isArray(contentTypeHeader) ? contentTypeHeader[0] : contentTypeHeader || '';
    
    if (!contentType.includes('application/json')) {
        return res.status(415).json({ error: "Unsupported Media Type. Use application/json." });
    }

    // Note: JSON.stringify is reliable for JSON payloads but not for multipart/binary.
    const bodySize = Buffer.byteLength(JSON.stringify(req.body || {}), 'utf8');
    if (bodySize > MAX_BODY_SIZE) {
         return res.status(413).json({ error: "Payload Too Large" });
    }

    // 5. AUTHENTICATION
    const authHeader = req.headers.authorization;
    const bearerToken = Array.isArray(authHeader) ? authHeader[0] : authHeader;

    if (!bearerToken || !bearerToken.startsWith('Bearer ')) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const idToken = bearerToken.split('Bearer ')[1];

    let uid = 'anonymous';

    try {
        if (!admin.apps.length) throw new Error("Firebase Admin not initialized");
        const decodedToken = await admin.auth().verifyIdToken(idToken);
        uid = decodedToken.uid;
    } catch (authError) {
        console.error(`[${requestId}] Auth Failed:`, authError);
        return res.status(403).json({ error: "Forbidden: Invalid Token" });
    }

    // 6. RATE LIMIT CHECK
    const rateLimitKey = `study:${uid}:${ip}`;
    if (await rateLimitExceeded(rateLimitKey)) {
        console.warn(`[${requestId}] Rate limit exceeded for: ${rateLimitKey}`);
        return res.status(429).json({ error: "Too Many Requests" });
    }

    // 7. INPUT VALIDATION
    const { context, question } = req.body as { context: StudyContext; question: string };

    if (!context || !question) {
        return res.status(400).json({ error: "Missing required fields: context and question" });
    }

    if (typeof question !== 'string' || question.length > 5000) {
        return res.status(400).json({ error: "Invalid question. Must be a string < 5000 chars." });
    }

    if (!context.subject || !context.topic || !context.difficultyLevel) {
        return res.status(400).json({ error: "Invalid context. Must include subject, topic, and difficultyLevel." });
    }

    if (!['beginner', 'intermediate', 'advanced'].includes(context.difficultyLevel)) {
        return res.status(400).json({ error: "Invalid difficultyLevel. Must be 'beginner', 'intermediate', or 'advanced'." });
    }

    // 8. BUILD ENHANCED PROMPT
    const previousContext = context.previousInteractions && context.previousInteractions.length > 0
      ? context.previousInteractions.slice(-5).join('\n')
      : 'No previous interactions';

    const enhancedPrompt = `
You are an expert ${context.subject} tutor at JNTUH (Jawaharlal Nehru Technological University Hyderabad), helping a ${context.difficultyLevel} level student.

Current Topic: ${context.topic}

Previous Conversation Context:
${previousContext}

Student's Question: ${question}

Instructions:
- Provide a clear, step-by-step explanation tailored to a ${context.difficultyLevel} student
- Include relevant formulas in LaTeX format when applicable (use $ for inline and $$ for display math)
- Provide practical examples related to JNTUH curriculum where relevant
- If the question is about a complex topic, break it down into smaller, digestible parts
- Use simple language for beginners, more technical terms for intermediate/advanced students
- Include diagrams or visual descriptions when they help clarify concepts
- Reference JNTUH-specific course materials or syllabus topics when appropriate

Your response should be educational, encouraging, and directly answer the student's question while building on any previous conversation context.
`;

    // 9. GEMINI CALL
    const API_KEY = process.env.GEMINI_API_KEY;
    if (!API_KEY) {
        console.error(`[${requestId}] Server Misconfiguration: Missing API Key`);
        return res.status(500).json({ error: "Internal Server Error" });
    }

    const ai = new GoogleGenAI({ apiKey: API_KEY });
    let aiText = '';
    
    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: enhancedPrompt,
        });
        
        // Defensive Extraction using Helper
        aiText = normalizeAiResponse(response);
        
        if (!aiText && response.candidates && response.candidates.length > 0) {
             console.warn(`[${requestId}] Parsing failed for response candidates`);
             aiText = "Response generated but could not be parsed.";
        }
    } catch (aiError: any) {
         console.error(`[${requestId}] AI Service Error:`, aiError.message);
         return res.status(502).json({ error: "AI Service Unavailable", requestId });
    }

    if (!aiText) {
         return res.status(500).json({ error: "Empty response from AI", requestId });
    }
    
    return res.status(200).json({ text: aiText });

  } catch (error: any) {
    console.error(`[${requestId}] Critical Error:`, error.message);
    return res.status(500).json({ error: "Internal Server Error", requestId });
  }
}
