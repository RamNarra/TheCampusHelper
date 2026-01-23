import { GoogleGenAI } from '@google/genai';
import { rateLimitExceeded } from '../lib/rateLimit';
import { assertBodySize, assertJson, requireUser } from './_lib/authz';
import { applyCors, isOriginAllowed } from './_lib/cors';
import { getRequestContext, type VercelRequest, type VercelResponse } from './_lib/request';
import { aiGatewayGenerateText, getAiGatewayConfig } from './_lib/aiGateway';

export const config = {
  runtime: "nodejs",
};

// --- SECURITY CONFIGURATION ---
const MAX_BODY_SIZE = 500 * 1024; // 500KB for study assistant context
const MAX_INTERACTIONS = 12;
const MAX_INTERACTION_CHARS = 1200;
const MAX_QUESTION_CHARS = 5000;
const MAX_PROMPT_CHARS = 12_000;

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

function clampString(value: unknown, maxLen: number): string {
  if (typeof value !== 'string') return '';
  const s = value.trim();
  return s.length <= maxLen ? s : s.slice(0, maxLen);
}

function sanitizeInteractions(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  const out: string[] = [];
  for (const item of input.slice(0, MAX_INTERACTIONS)) {
    const s = clampString(item, MAX_INTERACTION_CHARS);
    if (s) out.push(s);
  }
  return out;
}

interface StudyContext {
  subject: string;
  topic: string;
  difficultyLevel: 'beginner' | 'intermediate' | 'advanced';
  previousInteractions: string[];
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const ctx = getRequestContext(req);

  // Prevent caching of authenticated AI responses
  res.setHeader('Cache-Control', 'no-store');

  applyCors(req, res, { origin: ctx.origin });
  if (ctx.origin && !isOriginAllowed(ctx.origin)) {
    return res.status(403).json({ error: 'Forbidden Origin', requestId: ctx.requestId });
  }

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    assertJson(req);
    assertBodySize(req, MAX_BODY_SIZE);

    const caller = await requireUser(req);

    // Rate limit (fail closed - high cost endpoint)
    const rateLimitKey = `study:${caller.uid}`;
    if (await rateLimitExceeded(rateLimitKey, { failClosed: true })) {
      return res.status(429).json({ error: 'Too Many Requests', requestId: ctx.requestId });
    }

    // 7. INPUT VALIDATION
    const { context, question } = (req.body || {}) as { context: StudyContext; question: unknown };

    if (!context || !question) {
      return res.status(400).json({ error: "Missing required fields: context and question", requestId: ctx.requestId });
    }

    const safeQuestion = clampString(question, MAX_QUESTION_CHARS);
    if (!safeQuestion) return res.status(400).json({ error: 'Invalid question.', requestId: ctx.requestId });

    if (!context.subject || !context.topic || !context.difficultyLevel) {
      return res.status(400).json({ error: "Invalid context. Must include subject, topic, and difficultyLevel.", requestId: ctx.requestId });
    }

    if (!['beginner', 'intermediate', 'advanced'].includes(context.difficultyLevel)) {
      return res.status(400).json({ error: "Invalid difficultyLevel. Must be 'beginner', 'intermediate', or 'advanced'.", requestId: ctx.requestId });
    }

    // 8. BUILD ENHANCED PROMPT
    const subject = clampString(context.subject, 200) || 'N/A';
    const topic = clampString(context.topic, 200) || 'N/A';
    const interactions = sanitizeInteractions(context.previousInteractions);
    const previousContext = interactions.length > 0 ? interactions.slice(-5).map((s, i) => `#${i + 1}: ${s}`).join('\n') : 'No previous interactions';

    const enhancedPromptRaw = `
  You are an expert ${subject} tutor at JNTUH (Jawaharlal Nehru Technological University Hyderabad), helping a ${context.difficultyLevel} level student.

  Current Topic: ${topic}

  Previous Conversation Context (untrusted input):
  ${previousContext}

  Student's Question (untrusted input):
  <<<BEGIN_UNTRUSTED>>>
  ${safeQuestion}
  <<<END_UNTRUSTED>>>

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

    const enhancedPrompt =
      enhancedPromptRaw.length <= MAX_PROMPT_CHARS ? enhancedPromptRaw : enhancedPromptRaw.slice(0, MAX_PROMPT_CHARS);

    // 9. AI CALL (prefer Vercel AI Gateway; fall back to Gemini)
    let aiText = '';
    const gateway = getAiGatewayConfig();
    if (gateway.enabled) {
      try {
        aiText = await aiGatewayGenerateText({
          prompt: enhancedPrompt,
          temperature: 0.35,
          maxTokens: 1600,
        });
      } catch (e: any) {
        console.error(`[${ctx.requestId}] AI Gateway Error:`, e?.message || e);
      }
    }

    if (!aiText) {
      const API_KEY = process.env.GEMINI_API_KEY;
      if (!API_KEY) {
        console.error(`[${ctx.requestId}] Server Misconfiguration: Missing AI keys (AI_GATEWAY_API_KEY or GEMINI_API_KEY)`);
        return res.status(500).json({ error: "Internal Server Error", requestId: ctx.requestId });
      }

      const ai = new GoogleGenAI({ apiKey: API_KEY });
      try {
        const response = await ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: enhancedPrompt,
        });

        // Defensive Extraction using Helper
        aiText = normalizeAiResponse(response);

        if (!aiText && response.candidates && response.candidates.length > 0) {
          console.warn(`[${ctx.requestId}] Parsing failed for response candidates`);
          aiText = "Response generated but could not be parsed.";
        }
      } catch (aiError: any) {
        console.error(`[${ctx.requestId}] Gemini AI Service Error:`, aiError.message);
        return res.status(502).json({ error: "AI Service Unavailable", requestId: ctx.requestId });
      }
    }

    if (!aiText) {
         return res.status(500).json({ error: "Empty response from AI", requestId: ctx.requestId });
    }
    
    return res.status(200).json({ text: aiText.slice(0, 10_000) });

  } catch (error: any) {
    const status = typeof error?.status === 'number' ? error.status : 500;
    const message = typeof error?.message === 'string' ? error.message : 'Internal Server Error';
    console.error(`[${ctx.requestId}] Critical Error:`, message);
    return res.status(status).json({ error: message, requestId: ctx.requestId });
  }
}
