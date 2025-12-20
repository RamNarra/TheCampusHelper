import { doc, getDoc } from 'firebase/firestore';
import { getDb } from './firebaseClient';

// Phase-1 single-toggle: stored in Firestore at /config/phase1.
// This toggle is intentionally runtime-configurable (no rebuild) and is also referenced by Firestore rules.
// If the document/field is missing, we default to legacy mode (false).

let cachedValue: boolean | null = null;
let cacheExpiresAt = 0;

export const getPhase1ServerlessOnly = async (): Promise<boolean> => {
  const now = Date.now();
  if (cachedValue !== null && now < cacheExpiresAt) return cachedValue;

  const db = getDb();
  if (!db) {
    cachedValue = false;
    cacheExpiresAt = now + 30_000;
    return cachedValue;
  }

  try {
    const snap = await getDoc(doc(db, 'config', 'phase1'));
    const v = snap.exists() ? (snap.data() as any)?.serverlessOnly : undefined;
    cachedValue = v === true;
  } catch {
    cachedValue = false;
  }

  cacheExpiresAt = now + 30_000;
  return cachedValue;
};

export const clearPhase1ToggleCache = () => {
  cachedValue = null;
  cacheExpiresAt = 0;
};
