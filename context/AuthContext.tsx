import React, { createContext, useContext, useEffect, useState } from 'react';
import { UserProfile } from '../types';
import { api, mapAuthToProfile } from '../services/firebase';
import { initializeGamification, updateStreak, awardXP, XP_REWARDS } from '../services/gamification';

interface AuthContextType {
  user: UserProfile | null;
  loading: boolean;        // Layer 1: Is Firebase Auth initialized?
  profileLoaded: boolean;  // Layer 2: Is Firestore profile data fetched?
  signInWithGoogle: () => Promise<void>;
  signInAsAdmin: () => Promise<void>; // Kept for interface compatibility
  logout: () => Promise<void>;
  updateProfile: (data: Partial<UserProfile>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children?: React.ReactNode }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileLoaded, setProfileLoaded] = useState(false);

  useEffect(() => {
    // LAYER 1: Firebase Auth Listener
    const unsubscribeAuth = api.onAuthStateChanged((firebaseUser) => {
      if (firebaseUser) {
        // 1. Immediate: Map basic data from Google Token
        const basicProfile = mapAuthToProfile(firebaseUser);
        
        // 2. Optimistic Update: Unblock the UI immediately
        setUser(prev => ({ ...prev, ...basicProfile }));
        setLoading(false);

        // LAYER 2: Firestore Profile Listener
        // Subscribe to real-time updates for this user's profile
        const unsubscribeProfile = api.onProfileChanged(firebaseUser.uid, async (data) => {
            if (data) {
                // Merge DB data with existing state
                setUser(prev => prev ? ({ ...prev, ...data }) : null);
                
                // Initialize gamification for new users
                if (data.xp === undefined) {
                  await initializeGamification(firebaseUser.uid);
                } else {
                  // Update streak and award login XP for existing users
                  await updateStreak(firebaseUser.uid);
                  const today = new Date().toISOString().split('T')[0];
                  if (data.lastLoginDate !== today) {
                    await awardXP(firebaseUser.uid, XP_REWARDS.LOGIN, 'Daily login');
                  }
                }
            }
            // Mark profile as "Loaded" (success or empty)
            setProfileLoaded(true);
        });

        return () => unsubscribeProfile();

      } else {
        // User Logged Out
        setUser(null);
        setLoading(false);
        setProfileLoaded(false);
      }
    });

    return () => unsubscribeAuth();
  }, []);

  // --- ACTIONS ---

  const signInWithGoogle = async () => {
    try {
      await api.signIn();
    } catch (error) {
      console.error("Login Error:", error);
    }
  };

  const logout = async () => {
    try {
      await api.signOut();
    } catch (error) {
      console.error("Logout Error:", error);
    }
  };

  const updateProfile = async (data: Partial<UserProfile>) => {
    if (!user) return;
    
    // Optimistic UI Update
    setUser(prev => prev ? ({ ...prev, ...data }) : null);

    try {
        await api.updateProfile(user.uid, data);
    } catch (error) {
        console.error("Profile Update Failed:", error);
        // We don't revert optimistic update to keep UI fluid, 
        // but real-time listener would eventually correct it if offline.
    }
  };

  const signInAsAdmin = async () => {
    // Alias for standard login in this implementation
    await signInWithGoogle();
  };

  return (
    <AuthContext.Provider value={{ 
        user, 
        loading, 
        profileLoaded, 
        signInWithGoogle, 
        signInAsAdmin, 
        logout, 
        updateProfile 
    }}>
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
