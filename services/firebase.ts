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
import type { DocumentData } from 'firebase/firestore';
import { UserProfile, Resource, Quiz, QuizAttempt, QuizQuestion } from '../types';

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
    },

    /**
     * Generate quiz questions using AI
     */
    generateQuiz: async (subject: string, topic: string, difficulty: number, questionCount: number = 10): Promise<{ questions: QuizQuestion[], metadata: any }> => {
       const token = await getAuthToken();
       if (!token) throw new Error("User must be logged in to use AI features.");

       const response = await fetch('/api/generateQuiz', {
          method: 'POST',
          headers: {
             'Content-Type': 'application/json',
             'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ subject, topic, difficulty, questionCount })
       });

       if (!response.ok) {
          const err = await response.json();
          throw new Error(err.error || "Quiz generation failed");
       }

       return await response.json();
    },

    /**
     * Save a quiz to Firestore
     */
    saveQuiz: async (quiz: Omit<Quiz, 'id'>): Promise<string> => {
        if (!db) throw new Error("Database not configured");
        const docRef = await addDoc(collection(db, 'quizzes'), {
            ...quiz,
            createdAt: serverTimestamp()
        });
        return docRef.id;
    },

    /**
     * Save a quiz attempt to Firestore
     */
    saveQuizAttempt: async (attempt: Omit<QuizAttempt, 'id'>): Promise<string> => {
        if (!db) throw new Error("Database not configured");
        const docRef = await addDoc(collection(db, 'quizAttempts'), {
            ...attempt,
            completedAt: serverTimestamp()
        });
        return docRef.id;
    },

    /**
     * Get user's quiz attempts
     */
    getUserQuizAttempts: async (userId: string): Promise<QuizAttempt[]> => {
        if (!db) return [];
        const q = query(
            collection(db, 'quizAttempts'),
            orderBy('completedAt', 'desc')
        );
        const snap = await getDocs(q);
        return snap.docs
            .map(d => ({ id: d.id, ...d.data() } as QuizAttempt))
            .filter(attempt => attempt.userId === userId);
    }
};

export { auth, db, isConfigured };