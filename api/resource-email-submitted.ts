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

const MAX_BODY_SIZE = 50 * 1024; // 50KB

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

async function sendEmail(payload: { to: string; subject: string; html: string; idempotencyKey: string }) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  const replyTo = process.env.EMAIL_REPLY_TO;

  if (!apiKey || !from) {
    return { skipped: true as const, reason: 'email_not_configured' as const };
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      'Idempotency-Key': payload.idempotencyKey,
    },
    body: JSON.stringify({
      from,
      to: [payload.to],
      subject: payload.subject,
      html: payload.html,
      ...(replyTo ? { replyTo } : {}),
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Email provider error (${res.status}): ${text}`);
  }

  const data = await res.json().catch(() => ({}));
  return { skipped: false as const, data };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const requestId = crypto.randomUUID();

  res.setHeader('Cache-Control', 'no-store');

  const originHeader = req.headers.origin;
  const validatedOrigin = getValidatedOrigin(originHeader);

  if (originHeader && !validatedOrigin) {
    return res.status(403).json({ error: 'Forbidden Origin' });
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
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const contentTypeHeader = req.headers['content-type'];
  const contentType = Array.isArray(contentTypeHeader) ? contentTypeHeader[0] : contentTypeHeader || '';
  if (!contentType.includes('application/json')) {
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
  let decoded: admin.auth.DecodedIdToken;
  try {
    if (!admin.apps.length) throw new Error('Firebase Admin not initialized');
    decoded = await admin.auth().verifyIdToken(idToken);
  } catch (e) {
    console.error(`[${requestId}] Auth Failed:`, e);
    return res.status(403).json({ error: 'Forbidden: Invalid Token' });
  }

  const { resourceId } = (req.body || {}) as { resourceId?: string };
  if (!resourceId || typeof resourceId !== 'string' || resourceId.length > 200) {
    return res.status(400).json({ error: 'Invalid resourceId.' });
  }

  try {
    const db = admin.firestore();
    const resourceSnap = await db.collection('resources').doc(resourceId).get();
    if (!resourceSnap.exists) {
      return res.status(404).json({ error: 'Resource not found' });
    }
    const resource = resourceSnap.data() as any;
    if (!resource?.ownerId || resource.ownerId !== decoded.uid) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const profileSnap = await db.collection('users').doc(decoded.uid).get();
    const profile = profileSnap.exists ? (profileSnap.data() as any) : {};
    const toEmail = (decoded.email || profile.email || '').toString();
    if (!toEmail) {
      return res.status(200).json({ skipped: true, reason: 'missing_recipient_email' });
    }

    const baseUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : (validatedOrigin || '');
    const displayName = (profile.displayName || decoded.name || 'there').toString();
    const title = (resource.title || 'your resource').toString();
    const status = (resource.status || 'pending').toString();

    const subject = `We received your resource submission: ${title}`;
    const html = `
      <div style="font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial; line-height: 1.5; color: #111;">
        <h2 style="margin: 0 0 12px;">Thanks for contributing to The Campus Helper</h2>
        <p style="margin: 0 0 12px;">Hi ${displayName},</p>
        <p style="margin: 0 0 12px;">We’ve received your resource submission <strong>${title}</strong>.</p>
        <p style="margin: 0 0 12px;">Current status: <strong>${status === 'approved' ? 'Approved' : 'Submitted for approval'}</strong>.</p>
        ${baseUrl ? `<p style="margin: 0 0 12px;">You can visit <a href="${baseUrl}/resources">Resources</a> to preview it.</p>` : ''}
        <p style="margin: 0 0 0; color: #555;">If you didn’t submit this, you can ignore this email.</p>
      </div>
    `;

    const idempotencyKey = `resource-submitted:${resourceId}`;
    const result = await sendEmail({ to: toEmail, subject, html, idempotencyKey });
    return res.status(200).json({ ok: true, ...result });
  } catch (e: any) {
    console.error(`[${requestId}] Email submit error:`, e?.message || e);
    // Do not break UX if emails fail.
    return res.status(200).json({ ok: false, skipped: true, reason: 'email_send_failed' });
  }
}
