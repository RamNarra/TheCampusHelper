
import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { UserProfile } from '../types';
import { authService, auth, mapBasicUser, detectBranchAndYear } from '../services/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';

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

  // Reusable function to fetch and set user data
  const initUser = useCallback(async (firebaseUser: User) => {
    try {
      // 1. Map Basic Info from Google
      const basicProfile = mapBasicUser(firebaseUser);
      
      // 2. Fetch extra details from Firestore
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
          // Update last login time
          authService.saveUserData(firebaseUser.uid, {
            lastLogin: new Date().toISOString()
          } as any).catch(e => console.warn("Failed to update last login:", e));
      }

      // 4. Set final user state
      setUser(fullProfile);
    } catch (error) {
      console.error("Error initializing user data:", error);
      // Fallback
      setUser(mapBasicUser(firebaseUser));
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        await initUser(firebaseUser);
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [initUser]);

  const signInWithGoogle = async () => {
    try {
      setLoading(true);
      const result = await authService.signInWithGoogle();
      
      if (result) {
        // Explicitly initialize user to ensure state is updated before stopping loading
        // This acts as a safeguard in case onAuthStateChanged is delayed or doesn't trigger for re-auth
        await initUser(result.user);
      }
    } catch (error) {
      console.error("Login failed", error);
      alert("Google Sign-In failed. Please check your internet connection.");
    } finally {
      // Always stop loading after the explicit attempt
      setLoading(false);
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
