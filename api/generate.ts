import { GoogleGenAI } from "@google/genai";

// Vercel Node.js Serverless Function
export const config = {
  runtime: "nodejs",
};

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { prompt } = req.body || {};

    if (!prompt) {
      return res.status(400).json({ error: "Prompt is required" });
    }

    // The API key must be obtained exclusively from the environment variable process.env.API_KEY
    if (!process.env.API_KEY) {
      console.error("Missing API_KEY");
      return res.status(500).json({ error: "Server misconfiguration" });
    }

    // Always use new GoogleGenAI({apiKey: process.env.API_KEY});
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    // Use gemini-2.5-flash for basic text tasks
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
    });
    
    // Access the .text property directly
    const text = response.text;

    return res.status(200).json({ text });
  } catch (error: any) {
    console.error("Gemini API Error:", error);
    return res.status(500).json({
      error: "Gemini request failed",
      details: error?.message || "Unknown error",
    });
  }
}