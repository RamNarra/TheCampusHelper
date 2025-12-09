import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signOut, 
  User,
  UserCredential
} from 'firebase/auth';
import { 
  getFirestore, 
  doc, 
  getDoc, 
  setDoc, 
  collection, 
  getDocs, 
  addDoc, 
  Timestamp, 
  query, 
  onSnapshot, 
  Unsubscribe, 
  orderBy,
  DocumentReference
} from 'firebase/firestore';
import { getAnalytics } from "firebase/analytics";
import { UserProfile, Resource } from '../types';

// Access env safely to avoid TS errors or runtime crashes
const env = (import.meta as any).env || {};

// We use the environment variables if they exist.
// If they are missing (causing the crash), we fall back to the explicit production config.
// This prevents the app from breaking while ensuring we connect to the correct project.
const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY || "AIzaSyCWVGtXD-z6Opm6FVL2TJInsA5H4m0NYOY",
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || "thecampushelper-adcdc.firebaseapp.com",
  projectId: env.VITE_FIREBASE_PROJECT_ID || "thecampushelper-adcdc",
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || "thecampushelper-adcdc.firebasestorage.app",
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || "379448284100",
  appId: env.VITE_FIREBASE_APP_ID || "1:379448284100:web:d950e994d1abc2c2fc0a91",
  measurementId: env.VITE_FIREBASE_MEASUREMENT_ID || "G-K94JQ2GV7G"
};

// Initialize Firebase
console.log("🔥 Initializing Firebase...");
console.log("🔥 Firebase project:", firebaseConfig.projectId);

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const analytics = getAnalytics(app);
const googleProvider = new GoogleAuthProvider();

// Admin Email List - Controlled visibility
const ADMIN_EMAILS = [
  'admin@thecampushelper.com',
  'ramcharannarra8@gmail.com' 
];

// --- BRANCH DETECTION LOGIC ---
export const detectBranchAndYear = (
  email: string | null
): { branch?: 'CS_IT_DS' | 'AIML_ECE_CYS', year?: string } => {
  if (!email) return {};

  const parts = email.split('@');
  if (parts.length < 2) return {};

  const domainPart = parts[1]; 
  if (!domainPart.includes('sreenidhi.edu.in')) return {};

  const subdomain = domainPart.split('.')[0].toLowerCase(); 

  let branch: 'CS_IT_DS' | 'AIML_ECE_CYS' | undefined;

  if (['cse', 'it', 'ds', 'cs'].includes(subdomain)) {
    branch = 'CS_IT_DS';
  } else if (['ece', 'aiml', 'cys', 'ecm'].includes(subdomain)) {
    branch = 'AIML_ECE_CYS';
  }

  let year: string | undefined;
  const rollNo = parts[0].toUpperCase();
  if (/^\d{2}/.test(rollNo)) {
    const batchYear = parseInt(rollNo.substring(0, 2));
    const currentYearShort = new Date().getFullYear() % 100;
    const calculatedYear = (currentYearShort - batchYear) + 1;
    if (calculatedYear >= 1 && calculatedYear <= 4) {
      year = calculatedYear.toString();
    }
  }

  return { branch, year };
};

const mapBasicUser = (firebaseUser: User): UserProfile => {
  const emailLower = firebaseUser.email?.toLowerCase();
  const isAdmin = emailLower && ADMIN_EMAILS.includes(emailLower);

  return {
    uid: firebaseUser.uid,
    displayName: firebaseUser.displayName,
    email: firebaseUser.email,
    photoURL: firebaseUser.photoURL,
    role: isAdmin ? 'admin' : 'user',
  };
};

class AuthService {
  async signInWithGoogle(): Promise<UserCredential | null> {
    try {
      console.log("👉 AuthService: Calling signInWithPopup...");
      const result = await signInWithPopup(auth, googleProvider);
      console.log("✅ AuthService: Google Popup Success", result.user?.email);
      return result;
    } catch (error: any) {
      console.error("❌ AuthService Error:", error);
      if (error.code === 'auth/popup-closed-by-user') {
        return null;
      }
      throw error;
    }
  }

  async signInAsAdmin(): Promise<void> {
    await this.signInWithGoogle();
  }

  async logout(): Promise<void> {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Error signing out", error);
      throw error;
    }
  }

  async getUserData(uid: string): Promise<Partial<UserProfile> | null> {
    try {
      const docRef = doc(db, "users", uid);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        return docSnap.data() as Partial<UserProfile>;
      }
      return null;
    } catch (e) {
      console.warn("⚠️ AuthService: Could not fetch user data:", e);
      return null;
    }
  }

  async saveUserData(uid: string, data: Partial<UserProfile>): Promise<void> {
    try {
      const docRef = doc(db, "users", uid);
      await setDoc(docRef, data, { merge: true });
    } catch (e) {
      console.warn("⚠️ AuthService: Could not save user data:", e);
    }
  }

  subscribeToUserProfile(
    uid: string,
    onUpdate: (data: Partial<UserProfile> | null) => void
  ): Unsubscribe {
    const docRef = doc(db, "users", uid);
    return onSnapshot(
      docRef,
      (docSnap) => {
        if (docSnap.exists()) {
          onUpdate(docSnap.data() as Partial<UserProfile>);
        } else {
          onUpdate(null);
        }
      },
      (error) => {
        console.error("❌ Live Profile Subscription Error:", error);
        onUpdate(null);
      }
    );
  }

  async getAllUsers(): Promise<UserProfile[]> {
    try {
      const usersRef = collection(db, "users");
      const snapshot = await getDocs(usersRef);
      const users: UserProfile[] = [];
      snapshot.forEach((docSnap) => {
        users.push({ uid: docSnap.id, ...docSnap.data() } as UserProfile);
      });
      return users;
    } catch (e) {
      console.error("Error fetching all users:", e);
      return [];
    }
  }
}

// --- RESOURCE MANAGEMENT ---

export const extractDriveId = (url: string): string | null => {
  if (!url) return null;

  const idMatch = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (idMatch && idMatch[1]) return idMatch[1];

  const queryMatch = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (queryMatch && queryMatch[1]) return queryMatch[1];

  return null;
};

export const withTimeout = <T>(
  promise: Promise<T>, 
  ms: number = 10000
): Promise<T> => {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error('Request timed out')), ms)
    )
  ]);
};

export const resourceService = {
  async addResource(resource: Omit<Resource, 'id'>) {
    try {
      const docRef = await withTimeout<DocumentReference>(
        addDoc(collection(db, 'resources'), {
          ...resource,
          createdAt: Timestamp.now()
        }),
        10000
      );
      return { id: docRef.id, ...resource };
    } catch (e) {
      console.error("Error adding resource: ", e);
      throw e;
    }
  },

  async getAllResources(): Promise<Resource[]> {
    try {
      const qRef = query(collection(db, 'resources'));
      const querySnapshot = await getDocs(qRef);
      const resources: Resource[] = [];
      querySnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        resources.push({ id: docSnap.id, ...data } as Resource);
      });
      return resources;
    } catch (e) {
      console.error("Error getting resources: ", e);
      return [];
    }
  },

  subscribeToResources(callback: (resources: Resource[]) => void): Unsubscribe {
    const qRef = query(collection(db, 'resources'), orderBy('createdAt', 'desc'));

    return onSnapshot(
      qRef,
      (querySnapshot) => {
        const resources: Resource[] = [];
        querySnapshot.forEach((docSnap) => {
          const data = docSnap.data();
          resources.push({ id: docSnap.id, ...data } as Resource);
        });
        callback(resources);
      },
      (error) => {
        console.error("Error listening to resources:", error);
      }
    );
  }
};

export const authService = new AuthService();
export { auth, analytics, db, mapBasicUser };