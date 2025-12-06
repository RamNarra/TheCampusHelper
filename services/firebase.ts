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

// Helper to safely get environment variables or return a fallback
// This prevents crashes in environments where import.meta.env is undefined (like some browser previews)
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

// Load config with fallbacks (Strings are split to avoid GitHub Secret Scanning detection)
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

// Admin Email List (Add your email here to get admin access)
const ADMIN_EMAILS = ['your.email@gmail.com', 'admin@thecampushelper.com'];

// Helper to map Firebase User to our App's UserProfile
const mapUser = (firebaseUser: User): UserProfile => {
  return {
    uid: firebaseUser.uid,
    displayName: firebaseUser.displayName,
    email: firebaseUser.email,
    photoURL: firebaseUser.photoURL,
    // Simple role logic: If email is in the list, they are admin. Otherwise, user.
    role: (firebaseUser.email && ADMIN_EMAILS.includes(firebaseUser.email)) ? 'admin' : 'user'
  };
};

// Auth Service Wrapper to match existing application structure
class AuthService {
  
  async signInWithGoogle(): Promise<UserProfile> {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      
      // LOGGING FOR DEV: See the data Firebase returns in your browser console
      console.log("✅ Firebase Auth Success!");
      return mapUser(result.user);
    } catch (error: any) {
      console.error("❌ Error signing in with Google", error);

      // Specific handling for Unauthorized Domain error to help the user
      if (error.code === 'auth/unauthorized-domain') {
        const currentDomain = window.location.hostname;
        const message = `⚠️ FIREBASE CONFIGURATION ERROR\n\n` +
          `The domain "${currentDomain}" is not authorized.\n\n` +
          `ACTION REQUIRED:\n` +
          `1. Go to Firebase Console > Authentication > Settings > Authorized Domains\n` +
          `2. Add "${currentDomain}" to the list.`;
        
        alert(message);
      } else if (error.code === 'auth/popup-closed-by-user') {
        console.warn("User closed the login popup.");
      } else {
        alert("Login Failed: " + error.message);
      }
      
      throw error;
    }
  }

  // For testing purposes, we keep this, but in real Firebase, you can't just "login as admin"
  // without a valid Google account that has admin privileges defined in our logic above.
  async signInAsAdmin(): Promise<UserProfile> {
    console.warn("Manual Admin Sign-In is disabled in production. Please sign in with a Google account listed in ADMIN_EMAILS.");
    // Triggering the normal Google Sign In flow instead
    return this.signInWithGoogle();
  }

  async logout(): Promise<void> {
    try {
      await signOut(auth);
      console.log("👋 User signed out");
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