
import React, { createContext, useContext, useEffect, useState } from 'react';
import { UserProfile } from '../types';
import { authService, auth, mapBasicUser, detectBranchAndYear } from '../services/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { Unsubscribe } from 'firebase/firestore';

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
    console.log("🎧 AuthContext: Initializing Auth Listener");
    
    let profileUnsubscribe: Unsubscribe | undefined;

    const authUnsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      // 1. Clean up previous profile listener if it exists
      if (profileUnsubscribe) {
          profileUnsubscribe();
          profileUnsubscribe = undefined;
      }

      if (firebaseUser) {
        console.log("👤 User detected:", firebaseUser.email);
        
        // IMMEDIATE: Set basic user details
        const basicProfile = mapBasicUser(firebaseUser);
        setUser(basicProfile);
        
        // CRITICAL CHANGE: Stop loading IMMEDIATELY. 
        // Do not wait for Firestore. Do not wait for timeouts.
        // The app opens NOW.
        setLoading(false); 
        
        // 2. Setup live listener for this user (happens in background)
        profileUnsubscribe = authService.subscribeToUserProfile(firebaseUser.uid, (firestoreData) => {
             if (firestoreData) {
                 // Database has data, merge it silently
                 setUser(prev => ({ ...prev, ...basicProfile, ...firestoreData }));
             } else {
                 // No data in DB yet (First time user)
                 console.log("✨ Creating new user profile (Local)...");
                 const detected = detectBranchAndYear(firebaseUser.email);
                 const newProfile = { 
                     ...basicProfile, 
                     ...detected,
                     createdAt: new Date().toISOString(), 
                     lastLogin: new Date().toISOString()
                 };
                 
                 // Update local state
                 setUser(newProfile as UserProfile);

                 // Async save to DB (Background)
                 authService.saveUserData(firebaseUser.uid, newProfile).catch(e => 
                    console.error("Failed to create initial profile in DB", e)
                 );
             }
        });

      } else {
        // User logged out
        console.log("👋 User logged out");
        setUser(null);
        setLoading(false);
      }
    });

    return () => {
      authUnsubscribe();
      if (profileUnsubscribe) profileUnsubscribe();
    };
  }, []);

  const signInWithGoogle = async () => {
    // Safety timer for the POPUP itself (only for the login window interaction)
    const popupTimer = setTimeout(() => {
        setLoading((current) => {
            if (current) return false; 
            return current;
        });
    }, 15000);

    try {
      setLoading(true);
      const result = await authService.signInWithGoogle();
      
      if (!result) {
          setLoading(false);
      }
      // If success, onAuthStateChanged handles the rest INSTANTLY
      
    } catch (error) {
      console.error("Login failed", error);
      alert("Login failed. Please try again.");
      setLoading(false);
    } finally {
      clearTimeout(popupTimer);
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
    } catch (error) {
      console.error("Logout failed", error);
      setLoading(false);
    }
  };

  const updateProfile = async (data: Partial<UserProfile>) => {
    if (!user) return;
    try {
      // Optimistic update local state
      setUser(prev => prev ? ({ ...prev, ...data }) : null);
      // Background save
      await authService.saveUserData(user.uid, data);
    } catch (error) {
      console.error("Update profile failed", error);
      // Don't revert local state to avoid UI jumpiness, just log error
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
