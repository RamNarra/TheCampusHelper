
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged,
  User,
  UserCredential
} from 'firebase/auth';
import { getFirestore, doc, getDoc, setDoc, collection, getDocs, addDoc, Timestamp, query, onSnapshot, Unsubscribe, orderBy } from 'firebase/firestore';
import { getAnalytics } from "firebase/analytics";
import { UserProfile, Resource } from '../types';

// Helper to safely get environment variables
const getEnv = (key: string, fallback: string) => {
  try {
    // @ts-ignore - Vite specific
    if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env[key]) {
      // @ts-ignore
      return import.meta.env[key];
    }
  } catch (e) {
    // Ignore errors
  }
  return fallback;
};

const firebaseConfig = {
  apiKey: getEnv('VITE_FIREBASE_API_KEY', "AIzaSyCWVGtXD" + "-z6Opm6FVL2TJInsA5H4m0NYOY"),
  authDomain: getEnv('VITE_FIREBASE_AUTH_DOMAIN', "thecampushelper-adcdc.firebaseapp.com"),
  projectId: getEnv('VITE_FIREBASE_PROJECT_ID', "thecampushelper-adcdc"),
  storageBucket: getEnv('VITE_FIREBASE_STORAGE_BUCKET', "thecampushelper-adcdc.firebasestorage.app"),
  messagingSenderId: getEnv('VITE_FIREBASE_MESSAGING_SENDER_ID', "379448284100"),
  appId: getEnv('VITE_FIREBASE_APP_ID', "1:379448284100:web:d950e994d1abc2c2fc0a91"),
  measurementId: getEnv('VITE_FIREBASE_MEASUREMENT_ID', "G-K94JQ2GV7G")
};

// Initialize Firebase
console.log("🔥 Initializing Firebase...");
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const analytics = getAnalytics(app);
const googleProvider = new GoogleAuthProvider();

// Admin Email List - Controlled visibility
// Emails are normalized to lowercase for comparison
const ADMIN_EMAILS = [
  'admin@thecampushelper.com',
  'ramcharannarra8@gmail.com' 
];

// --- BRANCH DETECTION LOGIC (Helper for College Emails) ---
export const detectBranchAndYear = (email: string | null): { branch?: 'CS_IT_DS' | 'AIML_ECE_CYS', year?: string } => {
  if (!email) return {};

  const parts = email.split('@');
  if (parts.length < 2) return {};

  const domainPart = parts[1]; 
  // If not sreenidhi.edu.in, we can't detect
  if (!domainPart.includes('sreenidhi.edu.in')) return {};

  const subdomain = domainPart.split('.')[0].toLowerCase(); 

  let branch: 'CS_IT_DS' | 'AIML_ECE_CYS' | undefined;

  // Group A: CS, IT, DS
  if (['cse', 'it', 'ds', 'cs', 'ds'].includes(subdomain)) {
    branch = 'CS_IT_DS';
  } 
  // Group B: ECE, AIML, CYS (ECM often grouped here or separately, assuming here for now)
  else if (['ece', 'aiml', 'cys', 'ecm'].includes(subdomain)) {
    branch = 'AIML_ECE_CYS';
  }

  // Detect Year from Roll Number
  let year: string | undefined;
  const rollNo = parts[0].toUpperCase();
  if (/^\d{2}/.test(rollNo)) {
    const batchYear = parseInt(rollNo.substring(0, 2));
    const currentYearShort = new Date().getFullYear() % 100; // e.g., 24
    // Approx year calculation (Aug start)
    const calculatedYear = (currentYearShort - batchYear) + 1;
    if (calculatedYear >= 1 && calculatedYear <= 4) {
      year = calculatedYear.toString();
    }
  }

  return { branch, year };
};

const mapBasicUser = (firebaseUser: User): UserProfile => {
  // Safe comparison by lowercasing
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
      // 'auth/popup-closed-by-user' happens if user closes the window.
      // We return null so the UI can handle it gracefully.
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
      console.log("👋 AuthService: Signing out...");
      await signOut(auth);
    } catch (error) {
      console.error("Error signing out", error);
      throw error;
    }
  }

  async getUserData(uid: string): Promise<Partial<UserProfile> | null> {
    try {
      console.log(`🔍 AuthService: Fetching user data for ${uid}...`);
      const docRef = doc(db, "users", uid);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        console.log("📄 AuthService: User data found");
        return docSnap.data() as Partial<UserProfile>;
      }
      console.log("🤷 AuthService: No user document found");
      return null;
    } catch (e) {
      console.warn("⚠️ AuthService: Could not fetch user data (Firestore might be locked/unavailable):", e);
      return null;
    }
  }

  async saveUserData(uid: string, data: Partial<UserProfile>): Promise<void> {
    try {
      console.log(`💾 AuthService: Saving user data for ${uid}...`);
      const docRef = doc(db, "users", uid);
      await setDoc(docRef, data, { merge: true });
    } catch (e) {
      console.warn("⚠️ AuthService: Could not save user data (Firestore permissions/network):", e);
      // We don't throw here to prevent login blocking
    }
  }

  // --- NEW: Live Profile Listener ---
  // This listens for any changes in the user's document in real-time
  subscribeToUserProfile(uid: string, onUpdate: (data: Partial<UserProfile> | null) => void): Unsubscribe {
    const docRef = doc(db, "users", uid);
    
    // onSnapshot fires immediately with current data, and then on any future change
    return onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        console.log("📦 Live Profile Update for:", uid);
        onUpdate(docSnap.data() as Partial<UserProfile>);
      } else {
        console.log("✨ No profile doc found (Live listener)");
        onUpdate(null);
      }
    }, (error) => {
      console.error("❌ Live Profile Subscription Error:", error);
      // Don't crash, just return null so app can proceed with basic auth
      onUpdate(null);
    });
  }

  async getAllUsers(): Promise<UserProfile[]> {
    try {
      const usersRef = collection(db, "users");
      const snapshot = await getDocs(usersRef);
      const users: UserProfile[] = [];
      snapshot.forEach((doc) => {
        users.push({ uid: doc.id, ...doc.data() } as UserProfile);
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

  // 1. Handle typical /d/ID pattern (view, preview, edit)
  // Matches: .../d/12345/..., .../d/12345
  const idMatch = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (idMatch && idMatch[1]) return idMatch[1];

  // 2. Handle 'id=' query parameter (e.g. drive.google.com/open?id=12345)
  // Matches: ?id=12345, &id=12345
  const queryMatch = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (queryMatch && queryMatch[1]) return queryMatch[1];

  // 3. Handle 'folders/' pattern (e.g. drive.google.com/drive/folders/12345)
  const folderMatch = url.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  if (folderMatch && folderMatch[1]) return folderMatch[1];

  // If no patterns match, return null to indicate "Not a recognizble Drive ID"
  // The app should treat this as a standard external link.
  return null;
};

export const resourceService = {
  async addResource(resource: Omit<Resource, 'id'>) {
    try {
      const docRef = await addDoc(collection(db, 'resources'), {
        ...resource,
        createdAt: Timestamp.now()
      });
      return { id: docRef.id, ...resource };
    } catch (e) {
      console.error("Error adding resource: ", e);
      throw e;
    }
  },

  // OLD: One-time fetch
  async getAllResources(): Promise<Resource[]> {
    try {
      const q = query(collection(db, 'resources'));
      const querySnapshot = await getDocs(q);
      const resources: Resource[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        // @ts-ignore
        resources.push({ id: doc.id, ...data } as Resource);
      });
      return resources;
    } catch (e) {
      console.error("Error getting resources: ", e);
      return [];
    }
  },

  // NEW: Real-time Listener
  subscribeToResources(callback: (resources: Resource[]) => void): Unsubscribe {
    const q = query(collection(db, 'resources'), orderBy('createdAt', 'desc'));
    
    // onSnapshot returns an unsubscribe function
    return onSnapshot(q, (querySnapshot) => {
      const resources: Resource[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        // @ts-ignore
        resources.push({ id: doc.id, ...data } as Resource);
      });
      callback(resources);
    }, (error) => {
      console.error("Error listening to resources:", error);
    });
  }
};

export const authService = new AuthService();
export { auth, analytics, db, mapBasicUser };
