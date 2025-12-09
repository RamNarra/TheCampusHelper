
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

  // Use a live listener for the user profile.
  // This ensures that if the user completes their profile in the modal, 
  // the app state updates immediately without a reload.
  useEffect(() => {
    console.log("🎧 AuthContext: Initializing Auth Listener");
    
    let profileUnsubscribe: Unsubscribe | undefined;

    const authUnsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      // 1. Clean up previous profile listener if it exists (e.g. user switching)
      if (profileUnsubscribe) {
          profileUnsubscribe();
          profileUnsubscribe = undefined;
      }

      if (firebaseUser) {
        console.log("👤 User detected:", firebaseUser.email);
        
        // 2. Setup new live listener for this user
        profileUnsubscribe = authService.subscribeToUserProfile(firebaseUser.uid, (firestoreData) => {
             const basicProfile = mapBasicUser(firebaseUser);
             
             if (firestoreData) {
                 // Database has data, merge it
                 setUser({ ...basicProfile, ...firestoreData });
             } else {
                 // No data in DB yet (First time user)
                 // Auto-detect branch/year from email
                 console.log("✨ Creating new user profile...");
                 const detected = detectBranchAndYear(firebaseUser.email);
                 const newProfile = { 
                     ...basicProfile, 
                     ...detected,
                     createdAt: new Date().toISOString(), 
                     lastLogin: new Date().toISOString()
                 };
                 
                 // Update local state immediately so UI renders
                 setUser(newProfile as UserProfile);

                 // Async save to DB (will trigger this listener again when done, which is fine)
                 authService.saveUserData(firebaseUser.uid, newProfile).catch(e => 
                    console.error("Failed to create initial profile", e)
                 );
             }
             
             // Data loaded (or default created), stop loading spinner
             setLoading(false);
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
    // Safety timeout in case popup hangs or listener fails
    const safetyTimer = setTimeout(() => {
        setLoading((current) => {
            if (current) {
                console.warn("⏰ Login timed out - forcing loading false");
                return false; 
            }
            return current;
        });
    }, 15000);

    try {
      setLoading(true);
      const result = await authService.signInWithGoogle();
      
      // CRITICAL FIX: If user cancels popup (result is null), stop loading
      if (!result) {
          console.log("⚠️ Login cancelled or failed");
          setLoading(false);
      }
      // If result is success, the onAuthStateChanged listener above will fire,
      // fetch the profile, and then set loading(false).
      
    } catch (error) {
      console.error("Login failed", error);
      alert("Login failed. Please try again.");
      setLoading(false);
    } finally {
      clearTimeout(safetyTimer);
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
      // onAuthStateChanged will set user to null and loading to false
    } catch (error) {
      console.error("Logout failed", error);
      setLoading(false);
    }
  };

  const updateProfile = async (data: Partial<UserProfile>) => {
    if (!user) return;
    try {
      // Just save to DB. The live listener will automatically update the `user` state.
      await authService.saveUserData(user.uid, data);
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
