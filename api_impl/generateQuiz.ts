import { GoogleGenAI } from '@google/genai';
import { rateLimitExceeded } from '../lib/rateLimit';
import { applyCors, isOriginAllowed } from './_lib/cors';
import { assertBodySize, assertJson, requireUser } from './_lib/authz';
import { getRequestContext, type VercelRequest, type VercelResponse } from './_lib/request';

export const config = {
  runtime: "nodejs",
};

// --- SECURITY CONFIGURATION ---
const MAX_BODY_SIZE = 200 * 1024; // 200KB

type QuizOption = { id: 'A' | 'B' | 'C' | 'D'; text: string };
type QuizQuestion = { question: string; options: QuizOption[]; correctAnswer: 'A' | 'B' | 'C' | 'D'; explanation: string };

function isValidOption(o: any): o is QuizOption {
  return (
    o &&
    (o.id === 'A' || o.id === 'B' || o.id === 'C' || o.id === 'D') &&
    typeof o.text === 'string' &&
    o.text.trim().length > 0 &&
    o.text.length <= 300
  );
}

function isValidQuestion(q: any): q is QuizQuestion {
  if (!q || typeof q.question !== 'string' || q.question.trim().length === 0 || q.question.length > 800) return false;
  if (!Array.isArray(q.options) || q.options.length !== 4) return false;
  if (!q.options.every(isValidOption)) return false;
  const ids = q.options.map((o: any) => o.id);
  const uniqueIds = new Set(ids);
  if (uniqueIds.size !== 4) return false;
  if (!(q.correctAnswer === 'A' || q.correctAnswer === 'B' || q.correctAnswer === 'C' || q.correctAnswer === 'D')) return false;
  if (typeof q.explanation !== 'string' || q.explanation.trim().length === 0 || q.explanation.length > 3000) return false;
  return true;
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
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    assertJson(req);
    assertBodySize(req, MAX_BODY_SIZE);

    const caller = await requireUser(req);

    // Rate limit (fail closed - high cost endpoint)
    const rateLimitKey = `quiz:${caller.uid}`;
    if (await rateLimitExceeded(rateLimitKey, { failClosed: true })) {
      return res.status(429).json({ error: 'Too Many Requests', requestId: ctx.requestId });
    }

    // 7. INPUT VALIDATION
    const { subject, topic, difficulty, questionCount } = req.body || {};

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
      console.error(`[${ctx.requestId}] Server Misconfiguration: Missing API Key`);
      return res.status(500).json({ error: 'Internal Server Error', requestId: ctx.requestId });
    }

    const difficultyLabel: 'easy' | 'medium' | 'hard' = ['easy', 'medium', 'hard'][difficultyNum - 1] as 'easy' | 'medium' | 'hard';

    const prompt = `Generate ${count} multiple-choice questions about "${String(topic).trim()}" in the subject "${String(subject).trim()}" at ${difficultyLabel} difficulty level.

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
        
        // Extract response text defensively
        aiText = (response as any)?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
        if (!aiText) console.warn(`[${ctx.requestId}] Unexpected response structure`);
    } catch (aiError: any) {
         console.error(`[${ctx.requestId}] AI Service Error:`, aiError.message);
         return res.status(502).json({ error: 'AI Service Unavailable', requestId: ctx.requestId });
    }

    if (!aiText) {
      return res.status(500).json({ error: 'Empty response from AI', requestId: ctx.requestId });
    }
    
    // Parse JSON response
    let questions: any[] = [];
    try {
        // Clean up markdown code blocks if present
        const cleanedText = aiText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        questions = JSON.parse(cleanedText);
        
      if (!Array.isArray(questions) || questions.length === 0) throw new Error('Invalid question format');
      if (questions.length > 20) questions = questions.slice(0, 20);
      if (!questions.every(isValidQuestion)) throw new Error('Invalid question schema');
    } catch (parseError: any) {
      console.error(`[${ctx.requestId}] Parse Error:`, parseError.message);
      return res.status(500).json({ error: 'Failed to parse quiz data', requestId: ctx.requestId });
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
    console.error(`[${ctx.requestId}] Critical Error:`, error.message);
    return res.status(500).json({ error: 'Internal Server Error', requestId: ctx.requestId });
  }
}
