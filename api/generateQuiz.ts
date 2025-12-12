import { GoogleGenAI } from "@google/genai";
import crypto from 'crypto';
import * as admin from 'firebase-admin';
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

// --- FIREBASE ADMIN INIT ---
if (!admin.apps.length) {
    if (process.env.FIREBASE_PRIVATE_KEY) {
        try {
            admin.initializeApp({
                credential: admin.credential.cert({
                    projectId: process.env.VITE_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID,
                    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
                    privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
                }),
            });
        } catch (e) {
            console.error('Firebase Admin Init Error:', e);
        }
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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const requestId = crypto.randomUUID();
  
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
    const rateLimitKey = `quiz:${uid}:${ip}`;
    if (await rateLimitExceeded(rateLimitKey)) {
        console.warn(`[${requestId}] Rate limit exceeded for: ${rateLimitKey}`);
        return res.status(429).json({ error: "Too Many Requests" });
    }

    // 7. INPUT VALIDATION
    const { subject, topic, difficulty, questionCount } = req.body;

    if (!subject || typeof subject !== 'string' || subject.length > 200) {
        return res.status(400).json({ error: "Invalid subject. Must be a string < 200 chars." });
    }

    if (!topic || typeof topic !== 'string' || topic.length > 200) {
        return res.status(400).json({ error: "Invalid topic. Must be a string < 200 chars." });
    }

    const difficultyNum = parseInt(difficulty);
    if (isNaN(difficultyNum) || difficultyNum < 1 || difficultyNum > 3) {
        return res.status(400).json({ error: "Invalid difficulty. Must be 1 (easy), 2 (medium), or 3 (hard)." });
    }

    const count = parseInt(questionCount) || 10;
    if (count < 5 || count > 20) {
        return res.status(400).json({ error: "Invalid question count. Must be between 5 and 20." });
    }

    // 8. GEMINI CALL
    const API_KEY = process.env.GEMINI_API_KEY;
    if (!API_KEY) {
        console.error(`[${requestId}] Server Misconfiguration: Missing API Key`);
        return res.status(500).json({ error: "Internal Server Error" });
    }

    const difficultyLabel: 'easy' | 'medium' | 'hard' = ['easy', 'medium', 'hard'][difficultyNum - 1] as 'easy' | 'medium' | 'hard';

    const prompt = `Generate ${count} multiple-choice questions about "${topic}" in the subject "${subject}" at ${difficultyLabel} difficulty level.

Requirements:
1. Each question should have exactly 4 options (A, B, C, D)
2. Provide the correct answer and a brief explanation
3. Questions should be educational and accurate
4. Format the response as a valid JSON array with this exact structure:

[
  {
    "question": "The question text here?",
    "options": [
      {"id": "A", "text": "Option A text"},
      {"id": "B", "text": "Option B text"},
      {"id": "C", "text": "Option C text"},
      {"id": "D", "text": "Option D text"}
    ],
    "correctAnswer": "A",
    "explanation": "Brief explanation of why this is correct"
  }
]

Return ONLY the JSON array, no additional text or markdown formatting.`;

    const ai = new GoogleGenAI({ apiKey: API_KEY });
    let aiText = '';
    
    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
        });
        
        // Extract response text
        if (response.candidates && response.candidates[0]?.content?.parts?.[0]?.text) {
            aiText = response.candidates[0].content.parts[0].text;
        } else {
            console.warn(`[${requestId}] Unexpected response structure`);
            aiText = "";
        }
    } catch (aiError: any) {
         console.error(`[${requestId}] AI Service Error:`, aiError.message);
         return res.status(502).json({ error: "AI Service Unavailable", requestId });
    }

    if (!aiText) {
         return res.status(500).json({ error: "Empty response from AI", requestId });
    }
    
    // Parse JSON response
    let questions = [];
    try {
        // Clean up markdown code blocks if present
        const cleanedText = aiText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        questions = JSON.parse(cleanedText);
        
        if (!Array.isArray(questions) || questions.length === 0) {
            throw new Error("Invalid question format");
        }
    } catch (parseError: any) {
        console.error(`[${requestId}] Parse Error:`, parseError.message);
        return res.status(500).json({ error: "Failed to parse quiz data", requestId });
    }
    
    return res.status(200).json({ 
        questions,
        metadata: {
            subject,
            topic,
            difficulty: difficultyLabel,
            questionCount: questions.length
        }
    });

  } catch (error: any) {
    console.error(`[${requestId}] Critical Error:`, error.message);
    return res.status(500).json({ error: "Internal Server Error", requestId });
  }
}
