import * as admin from 'firebase-admin';

export function ensureFirebaseAdminApp(): typeof admin {
  if (admin.apps.length) return admin;

  const isProd = process.env.NODE_ENV === 'production';
  const projectId = process.env.FIREBASE_PROJECT_ID || (!isProd ? process.env.VITE_FIREBASE_PROJECT_ID : undefined);
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      'Firebase Admin Init Error: Missing FIREBASE_PROJECT_ID/FIREBASE_CLIENT_EMAIL/FIREBASE_PRIVATE_KEY'
    );
  }

  admin.initializeApp({
    credential: admin.credential.cert({
      projectId,
      clientEmail,
      privateKey: privateKey.replace(/\\n/g, '\n'),
    }),
  });

  return admin;
}
