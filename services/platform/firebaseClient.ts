import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';

export const env = (import.meta as any).env || {};

const isNonEmptyString = (v: unknown): v is string => {
  if (typeof v !== 'string') return false;
  const s = v.trim();
  if (!s) return false;
  const lower = s.toLowerCase();
  return lower !== 'undefined' && lower !== 'null';
};

const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID,
  measurementId: env.VITE_FIREBASE_MEASUREMENT_ID,
};

const REQUIRED_KEYS: Array<keyof typeof firebaseConfig> = ['apiKey', 'authDomain', 'projectId', 'appId'];

export const getFirebaseConfigDiagnostics = () => {
  const missing = REQUIRED_KEYS.filter((k) => !isNonEmptyString(firebaseConfig[k]));
  const ok = missing.length === 0;
  return {
    ok,
    missing,
    // Expose a minimal non-sensitive snapshot for debugging.
    values: {
      authDomain: String(firebaseConfig.authDomain || '').trim(),
      projectId: String(firebaseConfig.projectId || '').trim(),
      appIdPresent: isNonEmptyString(firebaseConfig.appId),
      apiKeyPresent: isNonEmptyString(firebaseConfig.apiKey),
    },
  };
};

export const isConfigured = getFirebaseConfigDiagnostics().ok;

let app: ReturnType<typeof initializeApp> | undefined;
let auth: Auth | undefined;
let db: Firestore | undefined;
let googleProvider: GoogleAuthProvider | undefined;

if (isConfigured) {
  try {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
    googleProvider = new GoogleAuthProvider();
    googleProvider.setCustomParameters({ prompt: 'select_account' });
  } catch (e) {
    console.error('Firebase Init Failed:', e);
  }
} else {
  try {
    const d = getFirebaseConfigDiagnostics();
    if (!d.ok) {
      console.warn('Firebase not configured. Missing:', d.missing.join(', '));
    }
  } catch {
    // Ignore diagnostics errors.
  }
}

export const getAuthClient = (): Auth | undefined => auth;
export const getDb = (): Firestore | undefined => db;
export const getGoogleProvider = (): GoogleAuthProvider | undefined => googleProvider;
