
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged,
  User 
} from 'firebase/auth';
import { getFirestore, doc, getDoc, setDoc, collection, getDocs } from 'firebase/firestore';
import { getAnalytics } from "firebase/analytics";
import { UserProfile } from '../types';

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
  
  async signInWithGoogle(): Promise<void> {
    try {
      console.log("Starting Google Sign In...");
      await signInWithPopup(auth, googleProvider);
      console.log("✅ Google Auth Popup Finished");
    } catch (error: any) {
      console.error("❌ Error in signInWithGoogle:", error);
      if (error.code !== 'auth/popup-closed-by-user') {
        throw error;
      }
    }
  }

  async signInAsAdmin(): Promise<void> {
    return this.signInWithGoogle();
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
      console.warn("Could not fetch user data (Firestore might be locked/unavailable):", e);
      return null;
    }
  }

  async saveUserData(uid: string, data: Partial<UserProfile>): Promise<void> {
    try {
      const docRef = doc(db, "users", uid);
      await setDoc(docRef, data, { merge: true });
    } catch (e) {
      console.warn("Could not save user data (Firestore permissions/network):", e);
      // We don't throw here to prevent login blocking
    }
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

export const authService = new AuthService();
export { auth, analytics, db, mapBasicUser };
