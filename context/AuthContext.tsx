
import React, { createContext, useContext, useEffect, useState } from 'react';
import { UserProfile } from '../types';
import { authService, auth, mapBasicUser, detectBranchAndYear } from '../services/firebase';
import { onAuthStateChanged } from 'firebase/auth';

interface AuthContextType {
  user: UserProfile | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signInAsAdmin: () => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (data: Partial<UserProfile>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children?: React.ReactNode }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Listen for auth state changes from Firebase
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          // 1. Map Basic Info from Google
          const basicProfile = mapBasicUser(firebaseUser);
          
          // 2. Fetch extra details from Firestore (Wait for this to ensure correct state)
          const firestoreData = await authService.getUserData(firebaseUser.uid);
          
          let fullProfile = { ...basicProfile, ...(firestoreData || {}) };
          
          // 3. New User Handling / Auto-Detection
          if (!firestoreData) {
             const detected = detectBranchAndYear(firebaseUser.email);
             fullProfile = { ...fullProfile, ...detected };
             
             // Create initial record in background
             await authService.saveUserData(firebaseUser.uid, {
               ...fullProfile,
               createdAt: new Date().toISOString(),
               lastLogin: new Date().toISOString()
             } as any);
          } else {
             // Update last login time for existing users in background
             authService.saveUserData(firebaseUser.uid, {
               lastLogin: new Date().toISOString()
             } as any).catch(e => console.warn("Failed to update last login:", e));
          }

          // 4. Set final user state
          setUser(fullProfile);
          
        } catch (error) {
          console.error("Auth initialization error:", error);
          // Fallback to basic user if DB fails
          setUser(mapBasicUser(firebaseUser));
        } finally {
          // 5. Finally stop loading - allows App to render content or modal based on correct data
          setLoading(false);
        }

      } else {
        setUser(null);
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const signInWithGoogle = async () => {
    try {
      setLoading(true);
      const result = await authService.signInWithGoogle();
      
      // If result is null, it means the user closed the popup/cancelled.
      // In this case, onAuthStateChanged WON'T fire (or state won't change), 
      // so we must manually turn off loading.
      if (!result) {
        setLoading(false);
      }
      
      // If result exists, onAuthStateChanged has been triggered by Firebase
      // and it will handle fetching data and eventually setting loading(false).
    } catch (error) {
      console.error("Login failed", error);
      setLoading(false);
      alert("Google Sign-In failed. Please check your internet connection.");
    }
  };

  const signInAsAdmin = async () => {
    try {
      await authService.signInAsAdmin();
    } catch (error) {
      console.error("Admin Login failed", error);
    }
  };

  const logout = async () => {
    try {
      await authService.logout();
      setUser(null);
    } catch (error) {
      console.error("Logout failed", error);
    }
  };

  const updateProfile = async (data: Partial<UserProfile>) => {
    if (!user) return;
    try {
      await authService.saveUserData(user.uid, data);
      setUser((prev) => prev ? { ...prev, ...data } : null);
    } catch (error) {
      console.error("Update profile failed", error);
      throw error;
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, signInWithGoogle, signInAsAdmin, logout, updateProfile }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
