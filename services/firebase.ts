import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged,
  User,
  Auth
} from 'firebase/auth';
import { 
  getFirestore, 
  doc, 
  setDoc, 
  addDoc, 
  collection, 
  getDocs, 
  query, 
  orderBy, 
  onSnapshot, 
  serverTimestamp,
  Firestore
} from 'firebase/firestore';
// Import types separately to avoid build issues
import type { DocumentData, QuerySnapshot } from 'firebase/firestore';
import { UserProfile, Resource } from '../types';

// --- CONFIGURATION ---
const env = (import.meta as any).env || {};

const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID,
  measurementId: env.VITE_FIREBASE_MEASUREMENT_ID
};

// Validate config presence
const isConfigured = !!firebaseConfig.apiKey && firebaseConfig.apiKey !== 'undefined';

// Initialize instances
let app;
let auth: Auth;
let db: Firestore;
let googleProvider: GoogleAuthProvider;

if (isConfigured) {
  try {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
    googleProvider = new GoogleAuthProvider();
  } catch (e) {
    console.error("Firebase Init Failed:", e);
  }
}

// --- UTILITIES ---

// 1. Timeout Wrapper for Async Operations (Prevents infinite spinners)
export const withTimeout = <T>(promise: Promise<T>, ms: number = 10000): Promise<T> => {
    return Promise.race([
        promise,
        new Promise<T>((_, reject) => 
            setTimeout(() => reject(new Error('Operation timed out. Check your connection.')), ms)
        )
    ]);
};

// 2. Drive ID Extractor
export const extractDriveId = (url: string): string | null => {
  if (!url) return null;
  const match = url.match(/[-\w]{25,}/);
  return match ? match[0] : null;
};

// 3. User Mapper (Auth User -> App Profile)
export const mapAuthToProfile = (user: User): UserProfile => {
  const email = user.email?.toLowerCase() || '';
  const adminEmails = (env.VITE_ADMIN_EMAILS || "").split(',').map((e: string) => e.trim().toLowerCase());
  const isAdmin = adminEmails.includes(email);

  return {
    uid: user.uid,
    displayName: user.displayName,
    email: user.email,
    photoURL: user.photoURL,
    role: isAdmin ? 'admin' : 'user',
    // These will be overwritten by Firestore if data exists
    branch: undefined,
    year: undefined
  };
};

// --- CORE SERVICES ---

export const api = {
    // AUTH METHODS
    signIn: async () => {
        if (!auth) throw new Error("Auth not configured");
        return signInWithPopup(auth, googleProvider);
    },

    signOut: async () => {
        if (!auth) return;
        return signOut(auth);
    },

    // PROFILE METHODS
    // Updates user profile in Firestore
    updateProfile: async (uid: string, data: Partial<UserProfile>) => {
        if (!db) return;
        const docRef = doc(db, 'users', uid);
        // Use withTimeout to ensure UI doesn't hang if offline
        return withTimeout(setDoc(docRef, data, { merge: true }), 5000);
    },

    // Fetches all users (Admin only)
    getAllUsers: async (): Promise<UserProfile[]> => {
        if (!db) return [];
        const snap = await getDocs(collection(db, 'users'));
        return snap.docs.map(d => ({ uid: d.id, ...d.data() } as UserProfile));
    },

    // RESOURCE METHODS
    addResource: async (resource: Omit<Resource, 'id'>) => {
        if (!db) throw new Error("Database not configured");
        
        return withTimeout(
            addDoc(collection(db, 'resources'), {
                ...resource,
                createdAt: serverTimestamp()
            }), 
            15000
        );
    },

    // SUBSCRIPTIONS
    // 1. Auth State
    onAuthStateChanged: (cb: (user: User | null) => void) => {
        if (!auth) { cb(null); return () => {}; }
        return onAuthStateChanged(auth, cb);
    },

    // 2. Profile Data (Specific User)
    onProfileChanged: (uid: string, cb: (data: DocumentData | undefined) => void) => {
        if (!db) { cb(undefined); return () => {}; }
        return onSnapshot(doc(db, 'users', uid), (snap) => {
            cb(snap.exists() ? snap.data() : undefined);
        });
    },

    // 3. Resources List
    onResourcesChanged: (cb: (resources: Resource[]) => void) => {
        if (!db) { cb([]); return () => {}; }
        const q = query(collection(db, 'resources'), orderBy('createdAt', 'desc'));
        return onSnapshot(q, (snap) => {
            const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as Resource));
            cb(list);
        });
    }
};

export { auth, db, isConfigured };
