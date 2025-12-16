import crypto from 'crypto';
import * as admin from 'firebase-admin';
import { Buffer } from 'buffer';

export const config = {
  runtime: 'nodejs',
};

// --- SECURITY CONFIGURATION ---

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

const MAX_BODY_SIZE = 20 * 1024; // 20KB

// Hard fallback allowlist so the project owner can always recover admin.
// Prefer using ADMIN_EMAILS on Vercel for additional admins.
const DEFAULT_ADMIN_EMAILS = ['ramcharannarra8@gmail.com'];

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

function parseAdminAllowlist(): string[] {
  const raw = (process.env.ADMIN_EMAILS || process.env.VITE_ADMIN_EMAILS || '').trim();
  const fromEnv = raw
    ? raw
        .split(',')
        .map((e) => e.trim().toLowerCase())
        .filter(Boolean)
    : [];

  return Array.from(
    new Set([...DEFAULT_ADMIN_EMAILS.map((e) => e.toLowerCase()), ...fromEnv])
  );
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const requestId = crypto.randomUUID();

  res.setHeader('Cache-Control', 'no-store');

  const originHeader = req.headers.origin;
  const validatedOrigin = getValidatedOrigin(originHeader);

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

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const contentTypeHeader = req.headers['content-type'];
  const contentType = Array.isArray(contentTypeHeader) ? contentTypeHeader[0] : contentTypeHeader || '';
  if (contentType && !contentType.includes('application/json')) {
    return res.status(415).json({ error: 'Unsupported Media Type. Use application/json.' });
  }

  const bodySize = Buffer.byteLength(JSON.stringify(req.body || {}), 'utf8');
  if (bodySize > MAX_BODY_SIZE) {
    return res.status(413).json({ error: 'Payload Too Large' });
  }

  const authHeader = req.headers.authorization;
  const bearerToken = Array.isArray(authHeader) ? authHeader[0] : authHeader;

  if (!bearerToken || !bearerToken.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const idToken = bearerToken.split('Bearer ')[1];

  try {
    if (!admin.apps.length) {
      const projectId = process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID;
      const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
      const privateKey = process.env.FIREBASE_PRIVATE_KEY;
      return res.status(500).json({
        error: 'admin_not_initialized',
        requestId,
        missing: {
          FIREBASE_PROJECT_ID: !projectId,
          FIREBASE_CLIENT_EMAIL: !clientEmail,
          FIREBASE_PRIVATE_KEY: !privateKey,
        },
      });
    }

    const decoded = await admin.auth().verifyIdToken(idToken);
    const email = (decoded.email || '').toLowerCase();
    const uid = decoded.uid;

    const allowlist = parseAdminAllowlist();
    if (!email || !allowlist.includes(email)) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const userRecord = await admin.auth().getUser(uid);
    const existingClaims = (userRecord.customClaims || {}) as Record<string, any>;
    if (existingClaims.admin !== true) {
      await admin.auth().setCustomUserClaims(uid, { ...existingClaims, admin: true });
    }

    // Keep Firestore role in sync for UI and back-compat.
    try {
      const db = admin.firestore();
      await db
        .collection('users')
        .doc(uid)
        .set(
          {
            role: 'admin',
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
    } catch (e) {
      console.error(`[${requestId}] Firestore role sync failed:`, e);
      // Claim is the important part for rules; don't fail the whole request.
    }

    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error(`[${requestId}] bootstrapAdmin failed:`, e);
    return res.status(500).json({ error: 'internal_error', requestId });
  }
}
