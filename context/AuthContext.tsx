
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
    console.log("🔄 initUser: Starting initialization for", firebaseUser.email);
    try {
      // 1. Map Basic Info from Google
      const basicProfile = mapBasicUser(firebaseUser);
      console.log("👤 initUser: Basic profile mapped");
      
      // 2. Fetch extra details from Firestore (WITH TIMEOUT)
      // If Firestore is blocked or slow, we don't want to hang the entire app
      console.log("🔥 initUser: Fetching Firestore data...");
      const firestorePromise = authService.getUserData(firebaseUser.uid);
      const timeoutPromise = new Promise<null>((resolve) => 
        setTimeout(() => {
          console.warn("⚠️ initUser: Firestore fetch timed out, proceeding with basic profile");
          resolve(null);
        }, 5000) // 5 second timeout for DB
      );
      
      const firestoreData = await Promise.race([firestorePromise, timeoutPromise]);
      console.log("📦 initUser: Firestore data received:", firestoreData ? "Yes" : "No");
      
      let fullProfile = { ...basicProfile, ...(firestoreData || {}) };
      
      // 3. New User Handling / Auto-Detection
      if (!firestoreData) {
          console.log("✨ initUser: New user detected or no DB data. Attempting auto-detection...");
          const detected = detectBranchAndYear(firebaseUser.email);
          fullProfile = { ...fullProfile, ...detected };
          
          // Create initial record in background
          authService.saveUserData(firebaseUser.uid, {
            ...fullProfile,
            createdAt: new Date().toISOString(),
            lastLogin: new Date().toISOString()
          } as any).catch(e => console.warn("Background save failed:", e));
      } else {
          // Update last login time
          authService.saveUserData(firebaseUser.uid, {
            lastLogin: new Date().toISOString()
          } as any).catch(e => console.warn("Failed to update last login:", e));
      }

      // 4. Set final user state
      console.log("✅ initUser: Setting user state");
      setUser(fullProfile);
    } catch (error) {
      console.error("❌ Error initializing user data:", error);
      // Fallback
      setUser(mapBasicUser(firebaseUser));
    }
  }, []);

  useEffect(() => {
    console.log("🎧 AuthContext: Setting up onAuthStateChanged listener");
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      console.log("📣 onAuthStateChanged triggered. User:", firebaseUser?.email || "null");
      
      if (firebaseUser) {
        await initUser(firebaseUser);
      } else {
        setUser(null);
      }
      
      console.log("🛑 AuthContext: Setting loading to false (listener)");
      setLoading(false);
    });

    return () => unsubscribe();
  }, [initUser]);

  const signInWithGoogle = async () => {
    // Safety timeout to kill loader if everything hangs (e.g. unknown promise lock)
    const safetyTimer = setTimeout(() => {
        setLoading((currentLoading) => {
            if (currentLoading) {
                console.error("⏰ Login operation timed out globally (15s). Force resetting loader.");
                return false;
            }
            return currentLoading;
        });
    }, 15000);

    try {
      console.log("🚀 AuthContext: signInWithGoogle called");
      setLoading(true);
      const result = await authService.signInWithGoogle();
      
      if (result) {
        console.log("✅ AuthContext: Google Sign In success, user:", result.user.email);
        // Explicitly initialize user to ensure state is updated before stopping loading
        await initUser(result.user);
      } else {
         console.log("⚠️ AuthContext: Google Sign In returned null (cancelled?)");
      }
    } catch (error) {
      console.error("❌ AuthContext: Login failed", error);
      alert("Google Sign-In failed. Please check your internet connection.");
    } finally {
      console.log("🏁 AuthContext: signInWithGoogle finally block - stopping loader");
      clearTimeout(safetyTimer);
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
      setLoading(true);
      await authService.logout();
      setUser(null);
    } catch (error) {
      console.error("Logout failed", error);
    } finally {
      setLoading(false);
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
