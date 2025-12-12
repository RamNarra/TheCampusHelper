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
  where,
  orderBy, 
  onSnapshot, 
  serverTimestamp,
  Firestore
} from 'firebase/firestore';
import type { DocumentData } from 'firebase/firestore';
import { UserProfile, Resource, ResourceInteraction } from '../types';

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

const isConfigured = !!firebaseConfig.apiKey && firebaseConfig.apiKey !== 'undefined';

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

// --- SECURE HELPERS ---

/**
 * Gets the current user's ID token for making authenticated backend requests.
 * @returns Promise<string | null>
 */
export const getAuthToken = async (): Promise<string | null> => {
  if (!auth || !auth.currentUser) return null;
  // forceRefresh = false (uses cached token if valid)
  return auth.currentUser.getIdToken(false);
};

// Timeout Wrapper for Async Operations
export const withTimeout = <T>(promise: Promise<T>, ms: number = 10000): Promise<T> => {
    return Promise.race([
        promise,
        new Promise<T>((_, reject) => 
            setTimeout(() => reject(new Error('Operation timed out. Check your connection.')), ms)
        )
    ]);
};

export const extractDriveId = (url: string): string | null => {
  if (!url) return null;
  const match = url.match(/[-\w]{25,}/);
  return match ? match[0] : null;
};

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

    // PROFILE METHODS (Direct Firestore Access via Rules)
    updateProfile: async (uid: string, data: Partial<UserProfile>) => {
        if (!db) return;
        const docRef = doc(db, 'users', uid);
        return withTimeout(setDoc(docRef, data, { merge: true }), 5000);
    },

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
    onAuthStateChanged: (cb: (user: User | null) => void) => {
        if (!auth) { cb(null); return () => {}; }
        return onAuthStateChanged(auth, cb);
    },

    onProfileChanged: (uid: string, cb: (data: DocumentData | undefined) => void) => {
        if (!db) { cb(undefined); return () => {}; }
        return onSnapshot(doc(db, 'users', uid), (snap) => {
            cb(snap.exists() ? snap.data() : undefined);
        });
    },

    onResourcesChanged: (cb: (resources: Resource[]) => void) => {
        if (!db) { cb([]); return () => {}; }
        const q = query(collection(db, 'resources'), orderBy('createdAt', 'desc'));
        return onSnapshot(q, (snap) => {
            const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as Resource));
            cb(list);
        });
    },

    // INTERACTION TRACKING METHODS
    trackInteraction: async (interaction: Omit<ResourceInteraction, 'id' | 'timestamp'>) => {
        if (!db) return;
        return withTimeout(
            addDoc(collection(db, 'interactions'), {
                ...interaction,
                timestamp: serverTimestamp()
            }),
            5000
        );
    },

    getUserInteractions: async (userId: string): Promise<ResourceInteraction[]> => {
        if (!db) return [];
        try {
            const q = query(
                collection(db, 'interactions'),
                where('userId', '==', userId),
                orderBy('timestamp', 'desc')
            );
            const snap = await getDocs(q);
            return snap.docs.map(d => ({ id: d.id, ...d.data() } as ResourceInteraction));
        } catch (error) {
            console.error('Error fetching user interactions:', error);
            return [];
        }
    },

    getAllInteractions: async (options?: { sinceDate?: Date }): Promise<ResourceInteraction[]> => {
        if (!db) return [];
        try {
            // Limit to last 30 days by default for privacy and performance
            const sinceDate = options?.sinceDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
            
            const q = query(
                collection(db, 'interactions'),
                where('timestamp', '>=', sinceDate),
                orderBy('timestamp', 'desc')
            );
            const snap = await getDocs(q);
            return snap.docs.map(d => ({ id: d.id, ...d.data() } as ResourceInteraction));
        } catch (error) {
            console.error('Error fetching all interactions:', error);
            return [];
        }
    },
    
    /**
     * Call the Vercel Backend Function securely.
     * Automatically attaches the Authorization header.
     * SECURITY NOTE: This fetches from the internal /api/generate proxy.
     * It DOES NOT call Google APIs directly.
     */
    generateContent: async (prompt: string): Promise<string> => {
       const token = await getAuthToken();
       if (!token) throw new Error("User must be logged in to use AI features.");

       // Direct call to our secure proxy
       const response = await fetch('/api/generate', {
          method: 'POST',
          headers: {
             'Content-Type': 'application/json',
             'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ prompt })
       });

       if (!response.ok) {
          const err = await response.json();
          throw new Error(err.error || "Generation failed");
       }

       const data = await response.json();
       return data.text;
    }
};

export { auth, db, isConfigured };