import React, { createContext, useContext, useEffect, useState } from 'react';
import { UserProfile } from '../types';
import { authService, mapBasicUser, subscribeToAuthChanges } from '../services/firebase';

interface AuthContextType {
  user: UserProfile | null;
  loading: boolean; // True only during initial Auth check
  profileLoaded: boolean; // True once Firestore has responded (data or no data)
  signInWithGoogle: () => Promise<void>;
  signInAsAdmin: () => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (data: Partial<UserProfile>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children?: React.ReactNode }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileLoaded, setProfileLoaded] = useState(false);

  useEffect(() => {
    // LAYER 1: Auth State Listener
    const unsubscribeAuth = subscribeToAuthChanges((firebaseUser) => {
      if (firebaseUser) {
        // 1. Immediate UI: Set basic user from Google Auth
        const basicProfile = mapBasicUser(firebaseUser);
        
        // Optimistically set user to unblock UI immediately
        setUser(prev => ({ ...prev, ...basicProfile }));
        setLoading(false);

        // LAYER 2: Background Profile Fetch
        // Subscribe to Firestore for this specific user
        const unsubscribeProfile = authService.subscribeToUserProfile(firebaseUser.uid, (firestoreData) => {
            if (firestoreData) {
                // Merge Firestore data into existing user state
                setUser(prev => prev ? ({ ...prev, ...firestoreData }) : null);
            }
            // Mark profile as loaded regardless of whether data exists
            setProfileLoaded(true);
        });

        // Cleanup profile listener when auth user changes
        return () => unsubscribeProfile();
        
      } else {
        // User logged out
        setUser(null);
        setLoading(false);
        setProfileLoaded(false);
      }
    });

    return () => unsubscribeAuth();
  }, []);

  const signInWithGoogle = async () => {
    try {
      await authService.signInWithGoogle();
      // No manual state setting needed; onAuthStateChanged handles it
    } catch (error) {
      console.error("Login failed", error);
    }
  };

  const signInAsAdmin = async () => {
    await authService.signInAsAdmin();
  };

  const logout = async () => {
    try {
      await authService.logout();
      // setUser(null) handled by listener
    } catch (error) {
      console.error("Logout failed", error);
    }
  };

  const updateProfile = async (data: Partial<UserProfile>) => {
    if (!user) return;
    
    // 1. Optimistic Update
    setUser(prev => prev ? ({ ...prev, ...data }) : null);

    // 2. Background Save
    try {
        await authService.saveUserData(user.uid, data);
    } catch (error) {
        console.error("Failed to save profile:", error);
        // Optional: Revert state if critical
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, profileLoaded, signInWithGoogle, signInAsAdmin, logout, updateProfile }}>
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