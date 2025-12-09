
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
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        // 1. Basic Auth Info derived from Google Account
        let profile = mapBasicUser(firebaseUser);

        try {
           // 2. Fetch existing data from Firestore
           const firestoreData = await authService.getUserData(firebaseUser.uid);
           
           if (firestoreData) {
             // Merge Firestore data (Branch, Year, etc.) with Google data
             profile = { ...profile, ...firestoreData };
             
             // Update the 'lastLogin' or refresh basic info in DB to keep it current
             // This ensures we have a record of them
             await authService.saveUserData(firebaseUser.uid, {
               email: profile.email,
               displayName: profile.displayName,
               photoURL: profile.photoURL,
               role: profile.role, // Ensure role is synced if admin status changes
               lastLogin: new Date().toISOString() // Optional: track login time
             } as any);

           } else {
             // 3. New User: Create initial record
             const detected = detectBranchAndYear(firebaseUser.email);
             if (detected.branch || detected.year) {
                profile = { ...profile, ...detected };
             }
             
             // Create the user document in Firestore immediately
             await authService.saveUserData(firebaseUser.uid, {
               ...profile,
               createdAt: new Date().toISOString()
             } as any);
           }
        } catch (error) {
           console.error("Error syncing with user database:", error);
           // If database fails, we still log the user in with basic Google info
           // This prevents the "nothing happens" bug if Firestore permissions/network fail
        }
        
        setUser(profile);
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const signInWithGoogle = async () => {
    try {
      setLoading(true); // Show loading state during popup interaction
      await authService.signInWithGoogle();
      // State updates via onAuthStateChanged
    } catch (error) {
      console.error("Login failed", error);
      setLoading(false); // Reset loading on error
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
