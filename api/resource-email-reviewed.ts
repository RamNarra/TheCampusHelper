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

  const { resourceId, status } = (req.body || {}) as { resourceId?: string; status?: string };
  if (!resourceId || typeof resourceId !== 'string' || resourceId.length > 200) {
    return res.status(400).json({ error: 'Invalid resourceId.' });
  }
  if (!status || typeof status !== 'string') {
    return res.status(400).json({ error: 'Invalid status.' });
  }
  if (status !== 'approved' && status !== 'rejected') {
    return res.status(400).json({ error: 'Unsupported status.' });
  }

  // Send email on approval or rejection.

  try {
    const db = admin.firestore();

    // RBAC: requester must be staff (admin/mod) in Firestore profile.
    const reviewerSnap = await db.collection('users').doc(decoded.uid).get();
    const reviewer = reviewerSnap.exists ? (reviewerSnap.data() as any) : null;
    const reviewerRole = reviewer?.role;
    if (reviewerRole !== 'admin' && reviewerRole !== 'mod') {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const resourceSnap = await db.collection('resources').doc(resourceId).get();
    if (!resourceSnap.exists) {
      return res.status(404).json({ error: 'Resource not found' });
    }
    const resource = resourceSnap.data() as any;

    const ownerId = (resource?.ownerId || '').toString();
    if (!ownerId) {
      return res.status(200).json({ ok: true, skipped: true, reason: 'missing_owner' });
    }

    const ownerSnap = await db.collection('users').doc(ownerId).get();
    const owner = ownerSnap.exists ? (ownerSnap.data() as any) : {};
    const toEmail = (owner.email || '').toString();
    if (!toEmail) {
      return res.status(200).json({ ok: true, skipped: true, reason: 'missing_recipient_email' });
    }

    const baseUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : (validatedOrigin || '');
    const displayName = (owner.displayName || 'there').toString();
    const title = (resource.title || 'your resource').toString();
    const rejectionReason = (resource.rejectionReason || '').toString();

    const subject =
      status === 'approved'
        ? `Your resource was approved: ${title}`
        : `Update on your resource submission: ${title}`;

    const html =
      status === 'approved'
        ? `
      <div style="font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial; line-height: 1.5; color: #111;">
        <h2 style="margin: 0 0 12px;">Good news — your resource was approved</h2>
        <p style="margin: 0 0 12px;">Hi ${displayName},</p>
        <p style="margin: 0 0 12px;">Your submission <strong>${title}</strong> has been approved and is now visible on The Campus Helper.</p>
        ${baseUrl ? `<p style="margin: 0 0 12px;">View it here: <a href="${baseUrl}/resources">Resources</a></p>` : ''}
        <p style="margin: 0 0 0; color: #555;">Thanks for contributing — it helps everyone.</p>
      </div>
    `
        : `
      <div style="font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial; line-height: 1.5; color: #111;">
        <h2 style="margin: 0 0 12px;">Your resource needs changes</h2>
        <p style="margin: 0 0 12px;">Hi ${displayName},</p>
        <p style="margin: 0 0 12px;">Your submission <strong>${title}</strong> was not approved at this time.</p>
        ${rejectionReason ? `<p style="margin: 0 0 12px;"><strong>Reason:</strong> ${rejectionReason}</p>` : ''}
        ${baseUrl ? `<p style="margin: 0 0 12px;">You can resubmit an updated link on <a href="${baseUrl}/resources">Resources</a>.</p>` : ''}
        <p style="margin: 0 0 0; color: #555;">Thanks for understanding — and thanks for contributing.</p>
      </div>
    `;

    const idempotencyKey = `resource-reviewed:${resourceId}:${status}`;
    const result = await sendEmail({ to: toEmail, subject, html, idempotencyKey });
    return res.status(200).json({ ok: true, ...result });
  } catch (e: any) {
    console.error(`[${requestId}] Email review error:`, e?.message || e);
    return res.status(200).json({ ok: false, skipped: true, reason: 'email_send_failed' });
  }
}
