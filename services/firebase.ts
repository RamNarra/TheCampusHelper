import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged,
  User 
} from 'firebase/auth';
import { UserProfile } from '../types';

// TODO: Replace with your actual Firebase project configuration from the Firebase Console
// Create a .env file in your root and add these variables starting with VITE_

// Use type assertion to avoid TypeScript error: Property 'env' does not exist on type 'ImportMeta'
const env = (import.meta as any).env;

const firebaseConfig = {
  apiKey: env?.VITE_FIREBASE_API_KEY || "AIzaSyD-MmPmEXAMPLEKEY",
  authDomain: env?.VITE_FIREBASE_AUTH_DOMAIN || "your-app.firebaseapp.com",
  projectId: env?.VITE_FIREBASE_PROJECT_ID || "your-app",
  storageBucket: env?.VITE_FIREBASE_STORAGE_BUCKET || "your-app.appspot.com",
  messagingSenderId: env?.VITE_FIREBASE_MESSAGING_SENDER_ID || "123456789",
  appId: env?.VITE_FIREBASE_APP_ID || "1:123456789:web:abc123456"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
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
      return mapUser(result.user);
    } catch (error) {
      console.error("Error signing in with Google", error);
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
export { auth }; // Exporting raw auth instance if needed elsewhere