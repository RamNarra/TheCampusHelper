
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged,
  User 
} from 'firebase/auth';
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
const analytics = getAnalytics(app);
const googleProvider = new GoogleAuthProvider();

// Admin Email List
const ADMIN_EMAILS = ['your.email@gmail.com', 'admin@thecampushelper.com'];

// --- BRANCH DETECTION LOGIC ---
const detectBranchAndYear = (email: string | null): { branch?: 'CS_IT_DS' | 'AIML_ECE_CYS', year?: string } => {
  if (!email) return {};

  const parts = email.split('@');
  if (parts.length < 2) return {};

  const domainPart = parts[1]; // e.g., "cse.sreenidhi.edu.in"
  const subdomain = domainPart.split('.')[0].toLowerCase(); // "cse"

  let branch: 'CS_IT_DS' | 'AIML_ECE_CYS' | undefined;

  // Map subdomains to our app's branch groups
  // Group A: CS, IT, DS
  if (['cse', 'it', 'ds', 'cs', 'ds'].includes(subdomain)) {
    branch = 'CS_IT_DS';
  } 
  // Group B: ECE, AIML, CYS (ECM often grouped here or separately, assuming here for now)
  else if (['ece', 'aiml', 'cys', 'ecm'].includes(subdomain)) {
    branch = 'AIML_ECE_CYS';
  }

  // Detect Year from Roll Number (first part of email usually)
  // Example: 21311A05K2 -> Starts with 21 -> Batch 2021
  let year: string | undefined;
  const rollNo = parts[0].toUpperCase();
  // Simple check if it starts with a year number (e.g., 21, 22, 23, 24)
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

const mapUser = (firebaseUser: User): UserProfile => {
  const { branch, year } = detectBranchAndYear(firebaseUser.email);
  
  return {
    uid: firebaseUser.uid,
    displayName: firebaseUser.displayName,
    email: firebaseUser.email,
    photoURL: firebaseUser.photoURL,
    role: (firebaseUser.email && ADMIN_EMAILS.includes(firebaseUser.email)) ? 'admin' : 'user',
    branch,
    year
  };
};

class AuthService {
  
  async signInWithGoogle(): Promise<UserProfile> {
    try {
      // 1. Trigger Google Popup
      const result = await signInWithPopup(auth, googleProvider);
      const email = result.user.email || '';

      // 2. DOMAIN LOCK CHECK
      // Check if email ends with sreenidhi.edu.in
      if (!email.endsWith('sreenidhi.edu.in') && !ADMIN_EMAILS.includes(email)) {
         // Fail safe: If it's an admin email, allow it even if not sreenidhi (for dev)
         // Otherwise, Logout immediately
         await signOut(auth);
         throw new Error('DOMAIN_RESTRICTED');
      }

      console.log("✅ SNIST Auth Success!");
      return mapUser(result.user);
    } catch (error: any) {
      if (error.message === 'DOMAIN_RESTRICTED') {
         alert("🚫 Access Denied\n\nPlease use your official college email ID (@sreenidhi.edu.in) to access student resources.");
         throw error;
      }

      console.error("❌ Error signing in", error);

      if (error.code === 'auth/unauthorized-domain') {
        const currentDomain = window.location.hostname;
        alert(`⚠️ Unauthorized Domain: ${currentDomain}\nPlease add this domain in Firebase Console.`);
      } else if (error.code !== 'auth/popup-closed-by-user') {
        alert("Login Failed: " + error.message);
      }
      
      throw error;
    }
  }

  async signInAsAdmin(): Promise<UserProfile> {
    console.warn("Dev Mode: Triggering Google Sign In");
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

  onAuthStateChanged(callback: (user: UserProfile | null) => void): () => void {
    return onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        callback(mapUser(firebaseUser));
      } else {
        callback(null);
      }
    });
  }
}

export const authService = new AuthService();
export { auth, analytics };
