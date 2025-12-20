import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { UserProfile } from '../types';
import { api, mapAuthToProfile } from '../services/firebase';
import { initializeGamification, updateStreak, awardXP, XP_REWARDS } from '../services/gamification';
import { isAtLeastRole, normalizeRole } from '../lib/rbac';

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
    let stopPresence: (() => void) | null = null;
    let presenceUid: string | null = null;

    const startPresence = (uid: string, profile: { displayName: string | null; photoURL: string | null }) => {
      const safeSet = (fn: () => Promise<any>) => fn().catch(() => undefined);

      const computeState = () => {
        try {
          return document.visibilityState === 'hidden' ? 'idle' : 'online';
        } catch {
          return 'online';
        }
      };

      const push = () => {
        const state = computeState();
        if (state === 'idle') {
          safeSet(() => api.setPresenceIdle(uid, profile));
        } else {
          safeSet(() => api.setPresenceOnline(uid, profile));
        }
      };

      const onVisibility = () => push();
      const onUnload = () => {
        // Best-effort only; async is not guaranteed to complete.
        api.setPresenceOffline(uid).catch(() => undefined);
      };

      push();
      const interval = window.setInterval(push, 25000);
      document.addEventListener('visibilitychange', onVisibility);
      window.addEventListener('beforeunload', onUnload);

      return () => {
        window.clearInterval(interval);
        document.removeEventListener('visibilitychange', onVisibility);
        window.removeEventListener('beforeunload', onUnload);
        api.setPresenceOffline(uid).catch(() => undefined);
      };
    };

    // LAYER 1: Firebase Auth Listener
    const unsubscribeAuth = api.onAuthStateChanged((firebaseUser) => {
      // Clean up any previous profile listener before switching users.
      if (unsubscribeProfile) {
        unsubscribeProfile();
        unsubscribeProfile = null;
      }

      if (stopPresence) {
        stopPresence();
        stopPresence = null;
        presenceUid = null;
      }

      if (firebaseUser) {
        // 1. Immediate: Map basic data from Google Token
        const basicProfile = mapAuthToProfile(firebaseUser);

        // Presence: start heartbeat immediately on auth.
        presenceUid = firebaseUser.uid;
        stopPresence = startPresence(firebaseUser.uid, {
          displayName: basicProfile.displayName,
          photoURL: basicProfile.photoURL,
        });
        
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

                // Admin recovery is intentionally manual (see Profile page) to avoid
                // probing the bootstrap endpoint on every login.
                attemptedAdminRecoveryRef.current = true;
                
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

        if (presenceUid) {
          api.setPresenceOffline(presenceUid).catch(() => undefined);
          presenceUid = null;
        }
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeProfile) unsubscribeProfile();
      if (stopPresence) stopPresence();
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
