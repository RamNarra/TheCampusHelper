import { GoogleGenAI } from "@google/genai";

export const config = {
  runtime: "nodejs",
};

// ALLOWED ORIGINS: Add your production domains here
const ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:3000',
  process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : ''
].filter(Boolean);

export default async function handler(req: any, res: any) {
  const origin = req.headers.origin;
  
  // 1. STRICT CORS POLICY
  if (origin && ALLOWED_ORIGINS.some(allowed => origin.startsWith(allowed))) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else {
    // Fallback for non-browser tools or undefined origin (be careful in strict prod)
    // res.setHeader('Access-Control-Allow-Origin', 'null'); 
  }
  
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');

  // Handle Preflight
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // 2. SECURITY: Mandatory Bearer Token
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: "Unauthorized: Missing ID Token" });
    }

    const idToken = authHeader.split('Bearer ')[1];

    // 3. TOKEN VERIFICATION (Server-Side)
    // We verify the token against Google's public keys. 
    // This confirms the user is who they say they are.
    const verifyRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${idToken}`);
    
    if (!verifyRes.ok) {
       console.error("Token verification failed");
       return res.status(403).json({ error: "Forbidden: Invalid or Expired Token" });
    }

    // Optional: Verify the token is for THIS specific Firebase Project
    const tokenClaims = await verifyRes.json();
    if (process.env.VITE_FIREBASE_PROJECT_ID && tokenClaims.aud !== process.env.VITE_FIREBASE_PROJECT_ID) {
       // Only enable this check if you are certain VITE_FIREBASE_PROJECT_ID matches the auth audience
       // return res.status(403).json({ error: "Forbidden: Token Audience Mismatch" });
    }

    // 4. SECURE CONFIGURATION CHECK
    const API_KEY = process.env.GEMINI_API_KEY;
    if (!API_KEY) {
      console.error("CRITICAL: GEMINI_API_KEY is missing in server environment variables.");
      return res.status(500).json({ error: "Server Configuration Error" });
    }

    // 5. INPUT VALIDATION
    const { prompt } = req.body;
    if (!prompt || typeof prompt !== 'string' || prompt.length > 5000) {
        return res.status(400).json({ error: "Invalid prompt. Must be a string under 5000 chars." });
    }

    // 6. GEMINI API CALL (Server-to-Server)
    const ai = new GoogleGenAI({ apiKey: API_KEY });
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
    });
    
    // 7. SANITIZED RESPONSE
    const text = response.text;
    return res.status(200).json({ text });

  } catch (error: any) {
    console.error("Secure API Error:", error.message);
    // Never send the raw error object to the client
    return res.status(500).json({
      error: "Internal Server Error",
      requestId: crypto.randomUUID() // Useful for debugging logs without leaking data
    });
  }
}