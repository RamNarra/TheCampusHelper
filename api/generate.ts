import { GoogleGenAI } from "@google/genai";

// Vercel Node.js Serverless Function Configuration
export const config = {
  runtime: "nodejs",
};

export default async function handler(req: any, res: any) {
  // 1. CORS Headers (Allow your frontend domain)
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*'); // RESTRICT THIS IN PRODUCTION to your actual domain
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // 2. Method Check
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed. Use POST." });
  }

  try {
    // 3. SECURITY: Authentication Check
    // We expect the frontend to send "Authorization: Bearer <firebase_id_token>"
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: "Unauthorized. Missing or invalid Authorization header." });
    }

    const idToken = authHeader.split('Bearer ')[1];

    // Verify token using Google's public tokeninfo endpoint
    // This avoids needing 'firebase-admin' dependency in Vercel for simple verification
    const verifyRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${idToken}`);
    
    if (!verifyRes.ok) {
       return res.status(401).json({ error: "Unauthorized. Invalid ID token." });
    }

    const tokenData = await verifyRes.json();
    
    // Optional: Check if the token belongs to YOUR Firebase project
    // if (tokenData.aud !== process.env.VITE_FIREBASE_PROJECT_ID) { ... }

    // 4. Input Validation
    const { prompt } = req.body || {};
    if (!prompt) {
      return res.status(400).json({ error: "Prompt is required in request body." });
    }

    if (!process.env.API_KEY) {
      console.error("CRITICAL: Missing API_KEY in server environment.");
      return res.status(500).json({ error: "Server configuration error." });
    }

    // 5. Generate Content
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
    });
    
    const text = response.text;
    return res.status(200).json({ text });

  } catch (error: any) {
    console.error("API Error:", error);
    return res.status(500).json({
      error: "Generation failed.",
      // In production, do not send error.message to client
      details: "Internal server error."
    });
  }
}