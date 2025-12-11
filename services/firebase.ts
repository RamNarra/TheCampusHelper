import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged,
  User,
  UserCredential,
  Auth
} from 'firebase/auth';
import { 
  getFirestore, 
  doc, 
  getDoc, 
  setDoc, 
  collection, 
  addDoc, 
  getDocs, 
  query, 
  orderBy, 
  onSnapshot, 
  serverTimestamp,
  Timestamp,
  // Types are imported separately to avoid "no exported member" errors
} from 'firebase/firestore';
import type {
  Firestore,
  DocumentReference,
  DocumentData
} from 'firebase/firestore';
import { getAnalytics } from 'firebase/analytics';
import { UserProfile, Resource } from '../types';

// Unsubscribe is often an alias for () => void and might not be exported as a value
type Unsubscribe = () => void;

// Access env safely
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

const isValidConfig = (config: typeof firebaseConfig) => {
  return (
    !!config.apiKey && 
    config.apiKey.length > 20 && 
    config.apiKey !== 'undefined' &&
    !config.apiKey.includes('placeholder')
  );
};

let isConfigured = isValidConfig(firebaseConfig);

let app;
let auth: Auth;
let db: Firestore;
let analytics;
let googleProvider: GoogleAuthProvider;

if (isConfigured) {
  try {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
    googleProvider = new GoogleAuthProvider();
  } catch (error) {
    console.error("❌ Firebase Initialization Error:", error);
    isConfigured = false;
  }
}

// --- HELPER: Timeout Promise ---
export const withTimeout = <T>(promise: Promise<T>, ms: number = 10000): Promise<T> => {
    return Promise.race([
        promise,
        new Promise<T>((_, reject) => 
            setTimeout(() => reject(new Error(`Operation timed out after ${ms}ms`)), ms)
        )
    ]);
};

// --- AUTH HELPERS ---

export const mapBasicUser = (firebaseUser: User): UserProfile => {
  // Simple mapping, admin check should be robust in real apps
  const emailLower = firebaseUser.email?.toLowerCase();
  const admins = (env.VITE_ADMIN_EMAILS || "").split(',').map((e:string) => e.trim().toLowerCase());
  const isAdmin = emailLower && admins.includes(emailLower);

  return {
    uid: firebaseUser.uid,
    displayName: firebaseUser.displayName,
    email: firebaseUser.email,
    photoURL: firebaseUser.photoURL,
    role: isAdmin ? 'admin' : 'user',
  };
};

export const subscribeToAuthChanges = (callback: (user: User | null) => void): Unsubscribe => {
  if (isConfigured && auth) {
    return onAuthStateChanged(auth, callback);
  }
  // Mock for demo/fallback
  callback(null);
  return () => {};
};

// --- SERVICES ---

export const authService = {
  async signInWithGoogle() {
    if (!isConfigured || !auth) throw new Error("Firebase not configured");
    return signInWithPopup(auth, googleProvider);
  },

  async logout() {
    if (!isConfigured || !auth) return;
    return signOut(auth);
  },

  async saveUserData(uid: string, data: Partial<UserProfile>) {
    if (!isConfigured || !db) return;
    const docRef = doc(db, "users", uid);
    // Merge true is critical to not overwrite existing data
    return setDoc(docRef, data, { merge: true });
  },

  subscribeToUserProfile(uid: string, onUpdate: (data: Partial<UserProfile> | null) => void): Unsubscribe {
    if (!isConfigured || !db) {
       onUpdate(null);
       return () => {};
    }
    return onSnapshot(doc(db, "users", uid), (docSnap) => {
      if (docSnap.exists()) {
        onUpdate(docSnap.data() as Partial<UserProfile>);
      } else {
        onUpdate(null);
      }
    });
  },

  async getAllUsers(): Promise<UserProfile[]> {
      if (!isConfigured || !db) return [];
      const snap = await getDocs(collection(db, "users"));
      return snap.docs.map(d => ({ uid: d.id, ...d.data() } as UserProfile));
  },
  
  async signInAsAdmin() {
      // Mock helper for dev
      console.warn("Admin simulation not available in prod mode");
  }
};

export const extractDriveId = (url: string): string | null => {
  if (!url) return null;
  const match = url.match(/[-\w]{25,}/);
  return match ? match[0] : null;
};

export const resourceService = {
  async addResource(resource: Omit<Resource, 'id'>) {
    if (!isConfigured || !db) throw new Error("Database not connected");
    
    // Wrap in timeout to prevent infinite spinners
    return withTimeout(
        addDoc(collection(db, 'resources'), {
            ...resource,
            createdAt: serverTimestamp()
        }),
        15000 // 15s timeout
    );
  },

  subscribeToResources(callback: (resources: Resource[]) => void): Unsubscribe {
    if (!isConfigured || !db) {
        callback([]);
        return () => {};
    }
    const q = query(collection(db, 'resources'), orderBy('createdAt', 'desc'));
    return onSnapshot(q, (snap) => {
        const items = snap.docs.map(d => ({ id: d.id, ...d.data() } as Resource));
        callback(items);
    });
  }
};

export { auth, db, isConfigured };