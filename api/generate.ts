import { GoogleGenAI } from "@google/genai";
import crypto from 'crypto';

export const config = {
  runtime: "nodejs",
};

// --- SECURITY CONFIGURATION ---

// 1. ALLOWED ORIGINS (Strict Whitelist)
const ALLOWED_ORIGINS = new Set([
  'http://localhost:5173',
  'http://localhost:3000',
  process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '',
  // Add your production domain here, e.g., 'https://thecampushelper.com'
]);

// 2. PAYLOAD LIMITS
const MAX_BODY_SIZE = 200 * 1024; // 200KB

// 3. RATE LIMITING (Token Bucket - In-Memory)
// Note: For production with multiple instances, use Redis (e.g., Vercel KV).
type Bucket = { tokens: number; last: number };
const RATE_LIMIT_MAP = new Map<string, Bucket>();
const RL_CAPACITY = 10;     // Max burst
const RL_REFILL_RATE = 0.5; // Tokens per second

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  let bucket = RATE_LIMIT_MAP.get(ip);
  
  if (!bucket) {
    bucket = { tokens: RL_CAPACITY, last: now };
    RATE_LIMIT_MAP.set(ip, bucket);
  }

  const elapsedSeconds = (now - bucket.last) / 1000;
  bucket.tokens = Math.min(RL_CAPACITY, bucket.tokens + (elapsedSeconds * RL_REFILL_RATE));
  bucket.last = now;

  if (bucket.tokens >= 1) {
    bucket.tokens -= 1;
    return true;
  }
  return false;
}

// --- TYPES ---

interface VercelRequest {
  headers: { [key: string]: string | string[] | undefined };
  method: string;
  body: { prompt?: unknown }; 
}

interface VercelResponse {
  setHeader: (key: string, value: string) => void;
  status: (code: number) => VercelResponse;
  json: (data: any) => void;
  end: () => void;
}

// --- HANDLER ---

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const requestId = crypto.randomUUID();
  
  // Normalize Origin and IP
  const origin = Array.isArray(req.headers.origin) ? req.headers.origin[0] : req.headers.origin;
  const ip = (req.headers['x-forwarded-for'] as string) || 'unknown-ip';

  // 1. CORS Headers & Preflight
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Content-Length');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // 2. STRICT METHOD CHECK
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // 3. ORIGIN ENFORCEMENT
  if (origin && !ALLOWED_ORIGINS.has(origin)) {
     console.warn(`[${requestId}] Blocked request from unauthorized origin: ${origin}`);
     return res.status(403).json({ error: "Forbidden Origin" });
  }

  try {
    // 4. CONTENT TYPE & SIZE CHECKS
    const contentTypeHeader = req.headers['content-type'];
    const contentType = Array.isArray(contentTypeHeader) ? contentTypeHeader[0] : contentTypeHeader || '';
    
    if (!contentType.includes('application/json')) {
        return res.status(415).json({ error: "Unsupported Media Type. Use application/json." });
    }

    const contentLength = parseInt((req.headers['content-length'] as string) || '0', 10);
    if (contentLength > MAX_BODY_SIZE) {
        return res.status(413).json({ error: "Payload Too Large" });
    }

    // 5. RATE LIMIT CHECK
    if (!checkRateLimit(ip)) {
        console.warn(`[${requestId}] Rate limit exceeded for IP: ${ip}`);
        return res.status(429).json({ error: "Too Many Requests" });
    }

    // 6. AUTHENTICATION (Bearer Token)
    const authHeader = req.headers.authorization;
    const bearerToken = Array.isArray(authHeader) ? authHeader[0] : authHeader;

    if (!bearerToken || !bearerToken.startsWith('Bearer ')) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const idToken = bearerToken.split('Bearer ')[1];

    // Verify Token (Lightweight verification via Google API)
    // Note: In a full Node environment with service accounts, use firebase-admin.
    const verifyRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${idToken}`);
    if (!verifyRes.ok) {
       console.error(`[${requestId}] Invalid Token`);
       return res.status(403).json({ error: "Forbidden: Invalid Token" });
    }

    // 7. INPUT VALIDATION
    const body = req.body as { prompt?: string };
    const prompt = body.prompt;

    if (!prompt || typeof prompt !== 'string' || prompt.length > 5000) {
        return res.status(400).json({ error: "Invalid prompt. Must be a string < 5000 chars." });
    }

    // 8. GEMINI CALL (Server-Side)
    const API_KEY = process.env.GEMINI_API_KEY;
    if (!API_KEY) {
        console.error(`[${requestId}] Server Misconfiguration: Missing API Key`);
        return res.status(500).json({ error: "Internal Server Error" });
    }

    const ai = new GoogleGenAI({ apiKey: API_KEY });
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
    });
    
    return res.status(200).json({ text: response.text });

  } catch (error: any) {
    console.error(`[${requestId}] Error:`, error.message);
    return res.status(500).json({ error: "Internal Server Error", requestId });
  }
}