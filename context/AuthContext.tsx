import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
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
  const gamificationInitializedRef = useRef(false);
  const attemptedAdminRecoveryRef = useRef(false);

  useEffect(() => {
    let unsubscribeProfile: (() => void) | null = null;

    // LAYER 1: Firebase Auth Listener
    const unsubscribeAuth = api.onAuthStateChanged((firebaseUser) => {
      // Clean up any previous profile listener before switching users.
      if (unsubscribeProfile) {
        unsubscribeProfile();
        unsubscribeProfile = null;
      }

      if (firebaseUser) {
        // 1. Immediate: Map basic data from Google Token
        const basicProfile = mapAuthToProfile(firebaseUser);
        
        // 2. Optimistic Update: Unblock the UI immediately
        setUser(prev => ({ ...prev, ...basicProfile }));
        setLoading(false);

        // LAYER 2: Firestore Profile Listener
        // Subscribe to real-time updates for this user's profile
        unsubscribeProfile = api.onProfileChanged(firebaseUser.uid, async (data) => {
            if (!data) {
                // Ensure a baseline profile exists (roles/disabled rely on this doc).
                // Rules prevent self-escalation: normal users can only create role='user'.
                try {
                  await api.updateProfile(firebaseUser.uid, {
                    displayName: basicProfile.displayName,
                    email: basicProfile.email,
                    photoURL: basicProfile.photoURL,
                    role: basicProfile.role,
                    disabled: false
                  } as any);
                } catch (e) {
                  // If this fails (offline/rules), we still allow UI to proceed.
                }
            }

            if (data) {
                // If disabled, force logout.
                if ((data as any).disabled === true) {
                  try {
                    await api.signOut();
                  } finally {
                    setUser(null);
                    setProfileLoaded(true);
                  }
                  return;
                }

                // Merge DB data with existing state
                setUser(prev => prev ? ({ ...prev, ...data }) : null);

                // Admin self-recovery: if this email is configured as admin in env,
                // but Firestore role got downgraded, restore via server bootstrap.
                // Note: We attempt once for any non-admin; the server allowlist is the real gate.
                const hasAdminInDb = (data as any).role === 'admin';
                if (!hasAdminInDb && !attemptedAdminRecoveryRef.current) {
                  attemptedAdminRecoveryRef.current = true;
                  try {
                    const ok = await api.bootstrapAdminAccess();
                    if (ok) {
                      // Force refresh so custom claims are picked up.
                      await firebaseUser.getIdToken(true);
                      // Optimistically reflect admin while Firestore catches up.
                      setUser(prev => prev ? ({ ...prev, role: 'admin' as any }) : prev);
                    }
                  } catch {
                    // Ignore recovery failures; user will remain non-admin.
                  }
                }
                
                // Only run gamification logic once per session to prevent infinite loops
                if (!gamificationInitializedRef.current) {
                  gamificationInitializedRef.current = true;
                  
                  // Initialize gamification for new users
                  if (data.xp === undefined) {
                    await initializeGamification(firebaseUser.uid);
                  } else {
                    // Update streak for existing users (this handles daily login XP internally)
                    const today = new Date().toISOString().split('T')[0];
                    if (data.lastLoginDate !== today) {
                      await updateStreak(firebaseUser.uid);
                      await awardXP(firebaseUser.uid, XP_REWARDS.LOGIN, 'Daily login');
                    }
                  }
                }
            }
            // Mark profile as "Loaded" (success or empty)
            setProfileLoaded(true);
        });
      } else {
        // User Logged Out
        setUser(null);
        setLoading(false);
        setProfileLoaded(false);
        gamificationInitializedRef.current = false;
        attemptedAdminRecoveryRef.current = false;
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeProfile) unsubscribeProfile();
    };
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
