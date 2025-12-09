
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

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Listen for auth state changes from Firebase
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        // 1. IMMEDIATE UPDATE: Log user in instantly with Google info
        // This ensures the UI updates (redirects to /profile) without waiting for DB
        const basicProfile = mapBasicUser(firebaseUser);
        setUser(basicProfile);
        setLoading(false);

        // 2. BACKGROUND SYNC: Fetch/Update extra details from Firestore
        // We do this async so it doesn't block the login experience
        (async () => {
          try {
            const firestoreData = await authService.getUserData(firebaseUser.uid);
            
            let fullProfile = { ...basicProfile, ...(firestoreData || {}) };
            
            // If user is new (no Firestore data) or needs branch update
            if (!firestoreData) {
               const detected = detectBranchAndYear(firebaseUser.email);
               fullProfile = { ...fullProfile, ...detected };
               
               // Create initial record
               await authService.saveUserData(firebaseUser.uid, {
                 ...fullProfile,
                 createdAt: new Date().toISOString(),
                 lastLogin: new Date().toISOString()
               } as any);
            } else {
               // Just update last login time for existing users
               await authService.saveUserData(firebaseUser.uid, {
                 lastLogin: new Date().toISOString()
               } as any);
            }

            // Update state again with the full profile (including branch/year from DB)
            // This might cause a minor re-render but ensures data consistency
            setUser(fullProfile);
          } catch (error) {
            console.error("Background DB Sync Warning:", error);
            // We don't log them out here; they are still authenticated via Google
          }
        })();

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
      await authService.signInWithGoogle();
      // We do NOT set loading(false) here because onAuthStateChanged will handle it
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
