import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged,
  User,
  Auth
} from 'firebase/auth';
import { 
  getFirestore, 
  doc, 
  setDoc, 
  addDoc, 
  collection, 
  getDocs, 
  getDoc,
  query, 
  where,
  orderBy, 
  limit,
  onSnapshot, 
  serverTimestamp,
  updateDoc,
  deleteDoc,
  arrayUnion,
  arrayRemove,
  Firestore,
  FieldValue
} from 'firebase/firestore';
import type { DocumentData } from 'firebase/firestore';
import { UserProfile, Resource, Quiz, QuizAttempt, QuizQuestion, StudyGroup, Message, Session, CollaborativeNote, ResourceInteraction, UserRole } from '../types';

// --- CONFIGURATION ---
const DEFAULT_INTERACTION_DAYS = 30; // Default time window for fetching interactions
const env = (import.meta as any).env || {};

const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID,
  measurementId: env.VITE_FIREBASE_MEASUREMENT_ID
};

const isConfigured = !!firebaseConfig.apiKey && firebaseConfig.apiKey !== 'undefined';

let app;
let auth: Auth;
let db: Firestore;
let googleProvider: GoogleAuthProvider;

if (isConfigured) {
  try {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
    googleProvider = new GoogleAuthProvider();
  } catch (e) {
    console.error("Firebase Init Failed:", e);
  }
}

// --- SECURE HELPERS ---

/**
 * Gets the current user's ID token for making authenticated backend requests.
 * @returns Promise<string | null>
 */
export const getAuthToken = async (): Promise<string | null> => {
  if (!auth || !auth.currentUser) return null;
  // forceRefresh = false (uses cached token if valid)
  return auth.currentUser.getIdToken(false);
};

// Timeout Wrapper for Async Operations
export const withTimeout = <T>(promise: Promise<T>, ms: number = 10000): Promise<T> => {
    return Promise.race([
        promise,
        new Promise<T>((_, reject) => 
            setTimeout(() => reject(new Error('Operation timed out. Check your connection.')), ms)
        )
    ]);
};

export const extractDriveId = (url: string): string | null => {
  if (!url) return null;
  const match = url.match(/[-\w]{25,}/);
  return match ? match[0] : null;
};

export const mapAuthToProfile = (user: User): UserProfile => {
  const email = user.email?.toLowerCase() || '';
  const adminEmails = (env.VITE_ADMIN_EMAILS || "").split(',').map((e: string) => e.trim().toLowerCase());
  const isAdmin = adminEmails.includes(email);

  return {
    uid: user.uid,
    displayName: user.displayName,
    email: user.email,
    photoURL: user.photoURL,
    role: isAdmin ? 'admin' : 'user',
    branch: undefined,
        year: undefined,
        section: undefined,
        dateOfBirth: undefined,
        collegeEmail: undefined,
        profileCompleted: undefined
  };
};

// --- CORE SERVICES ---

export const api = {
    // AUTH METHODS
    signIn: async () => {
        if (!auth) throw new Error("Auth not configured");
        return signInWithPopup(auth, googleProvider);
    },

    signOut: async () => {
        if (!auth) return;
        return signOut(auth);
    },

    // PROFILE METHODS (Direct Firestore Access via Rules)
    updateProfile: async (uid: string, data: Partial<UserProfile>) => {
        if (!db) return;
        const docRef = doc(db, 'users', uid);
        return withTimeout(setDoc(docRef, data, { merge: true }), 5000);
    },

    getAllUsers: async (): Promise<UserProfile[]> => {
        if (!db) return [];
        const snap = await getDocs(collection(db, 'users'));
        return snap.docs.map(d => ({ uid: d.id, ...d.data() } as UserProfile));
    },

    updateUserRole: async (targetUid: string, role: UserRole) => {
        if (!db) throw new Error("Database not configured");
        const docRef = doc(db, 'users', targetUid);
        return withTimeout(updateDoc(docRef, { role, updatedAt: serverTimestamp() }), 5000);
    },

    setUserDisabled: async (targetUid: string, disabled: boolean) => {
        if (!db) throw new Error("Database not configured");
        const docRef = doc(db, 'users', targetUid);
        return withTimeout(updateDoc(docRef, { disabled, updatedAt: serverTimestamp() }), 5000);
    },

    // RESOURCE METHODS
    addResource: async (resource: Omit<Resource, 'id'>): Promise<string> => {
        if (!db) throw new Error("Database not configured");

        const fallbackOwnerId = auth?.currentUser?.uid;
        const ownerId = resource.ownerId || fallbackOwnerId;
        if (!ownerId) throw new Error('You must be signed in to upload a resource.');

        const isAdminEmail = (() => {
          const email = auth?.currentUser?.email?.toLowerCase() || '';
          const adminEmails = (env.VITE_ADMIN_EMAILS || "")
            .split(',')
            .map((e: string) => e.trim().toLowerCase())
            .filter(Boolean);
          return !!email && adminEmails.includes(email);
        })();

        const status = resource.status || (isAdminEmail ? 'approved' : 'pending');

        const docRef = await withTimeout(
            addDoc(collection(db, 'resources'), {
                ...resource,
                ownerId,
                status,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            }),
            15000
        );

        return docRef.id;
    },

    // SUBSCRIPTIONS
    onAuthStateChanged: (cb: (user: User | null) => void) => {
        if (!auth) { cb(null); return () => {}; }
        return onAuthStateChanged(auth, cb);
    },

    onProfileChanged: (uid: string, cb: (data: DocumentData | undefined) => void) => {
        if (!db) { cb(undefined); return () => {}; }
        return onSnapshot(doc(db, 'users', uid), (snap) => {
            cb(snap.exists() ? snap.data() : undefined);
        });
    },

    // --- RESOURCES (safe queries) ---
    onApprovedResourcesChanged: (cb: (resources: Resource[]) => void) => {
        if (!db) { cb([]); return () => {}; }
        const q = query(
            collection(db, 'resources'),
            where('status', '==', 'approved'),
            limit(500)
        );
        return onSnapshot(q, (snap) => {
            const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as Resource));
            const toMillis = (t: any): number => (typeof t === 'number' ? t : t?.toMillis?.() ?? 0);
            list.sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
            cb(list);
        });
    },

    onMyPendingResourcesChanged: (uid: string, cb: (resources: Resource[]) => void) => {
        if (!db) { cb([]); return () => {}; }
        const q = query(
            collection(db, 'resources'),
            where('ownerId', '==', uid),
            where('status', '==', 'pending'),
            limit(200)
        );
        return onSnapshot(q, (snap) => {
            const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as Resource));
            const toMillis = (t: any): number => (typeof t === 'number' ? t : t?.toMillis?.() ?? 0);
            list.sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
            cb(list);
        });
    },

    onAllResourcesChanged: (cb: (resources: Resource[]) => void) => {
        if (!db) { cb([]); return () => {}; }
        const q = query(collection(db, 'resources'), orderBy('createdAt', 'desc'), limit(1000));
        return onSnapshot(q, (snap) => {
            const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as Resource));
            cb(list);
        });
    },

    onPendingResourcesChanged: (cb: (resources: Resource[]) => void) => {
        if (!db) { cb([]); return () => {}; }
        const q = query(
            collection(db, 'resources'),
            where('status', '==', 'pending'),
            limit(500)
        );
        return onSnapshot(q, (snap) => {
            const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as Resource));
            const toMillis = (t: any): number => (typeof t === 'number' ? t : t?.toMillis?.() ?? 0);
            list.sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
            cb(list);
        });
    },

    updateResourceStatus: async (
        resourceId: string,
        status: 'approved' | 'rejected' | 'pending',
        options?: { rejectionReason?: string | null }
    ) => {
        if (!db) throw new Error("Database not configured");
        const uid = auth?.currentUser?.uid;
        if (!uid) throw new Error('You must be signed in.');
        const docRef = doc(db, 'resources', resourceId);

        const isModerated = status === 'approved' || status === 'rejected';
        const rejectionReason = status === 'rejected' ? (options?.rejectionReason ?? '') : null;

        const result = await withTimeout(
            updateDoc(docRef, {
                status,
                ...(isModerated
                    ? { reviewedBy: uid, reviewedAt: serverTimestamp() }
                    : { reviewedBy: null, reviewedAt: null }),
                rejectionReason,
                updatedAt: serverTimestamp(),
            }),
            5000
        );

        return result;
    },

    deleteResource: async (resourceId: string) => {
        if (!db) throw new Error("Database not configured");
        const uid = auth?.currentUser?.uid;
        if (!uid) throw new Error('You must be signed in.');
        const docRef = doc(db, 'resources', resourceId);
        return withTimeout(deleteDoc(docRef), 5000);
    },

    // INTERACTION TRACKING METHODS
    trackInteraction: async (interaction: Omit<ResourceInteraction, 'id' | 'timestamp'>) => {
        if (!db) return;
        return withTimeout(
            addDoc(collection(db, 'interactions'), {
                ...interaction,
                timestamp: serverTimestamp()
            }),
            5000
        );
    },

    getUserInteractions: async (userId: string): Promise<ResourceInteraction[]> => {
        if (!db) return [];
        try {
            // Avoid composite-index requirements by not ordering server-side.
            const q = query(
                collection(db, 'interactions'),
                where('userId', '==', userId),
                limit(200)
            );
            const snap = await getDocs(q);
            const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as ResourceInteraction));
            const toMillis = (t: any): number => {
                if (typeof t === 'number') return t;
                return t?.toMillis?.() ?? 0;
            };
            return list.sort((a, b) => toMillis(b.timestamp) - toMillis(a.timestamp));
        } catch (error) {
            console.error('Error fetching user interactions:', error);
            return [];
        }
    },

    getAllInteractions: async (options?: { sinceDate?: Date }): Promise<ResourceInteraction[]> => {
        if (!db) return [];
        try {
            // Client-side code should not be pulling other users' interactions.
            // Keep this as a safe no-op unless an admin is signed in.
            const email = auth?.currentUser?.email?.toLowerCase() || '';
            const adminEmails = (env.VITE_ADMIN_EMAILS || '')
                .split(',')
                .map((e: string) => e.trim().toLowerCase())
                .filter(Boolean);
            if (!email || !adminEmails.includes(email)) return [];

            // Note: We fetch all recent interactions but filter by a reasonable window
            // The timestamp field uses serverTimestamp() which converts to milliseconds in the stored document
            const q = query(
                collection(db, 'interactions'),
                orderBy('timestamp', 'desc'),
                limit(2000)
            );
            const snap = await getDocs(q);
            const cutoffTime = (options?.sinceDate || new Date(Date.now() - DEFAULT_INTERACTION_DAYS * 24 * 60 * 60 * 1000)).getTime();
            
            return snap.docs
                .map(d => ({ id: d.id, ...d.data() } as ResourceInteraction))
                .filter(interaction => {
                    const timestamp = typeof interaction.timestamp === 'number' 
                        ? interaction.timestamp 
                        : (interaction.timestamp as any)?.toMillis?.() || 0;
                    return timestamp >= cutoffTime;
                });
        } catch (error) {
            console.error('Error fetching all interactions:', error);
            return [];
        }
    },
    
    /**
     * Call the Vercel Backend Function securely.
     * Automatically attaches the Authorization header.
     * SECURITY NOTE: This fetches from the internal /api/generate proxy.
     * It DOES NOT call Google APIs directly.
     */
    generateContent: async (prompt: string): Promise<string> => {
       const token = await getAuthToken();
       if (!token) throw new Error("User must be logged in to use AI features.");

       // Direct call to our secure proxy
       const response = await fetch('/api/generate', {
          method: 'POST',
          headers: {
             'Content-Type': 'application/json',
             'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ prompt })
       });

       if (!response.ok) {
          const err = await response.json();
          throw new Error(err.error || "Generation failed");
       }

       const data = await response.json();
       return data.text;
    },

    /**
     * Generate quiz questions using AI
     */
    generateQuiz: async (subject: string, topic: string, difficulty: number, questionCount: number = 10): Promise<{ questions: QuizQuestion[], metadata: any }> => {
       const token = await getAuthToken();
       if (!token) throw new Error("User must be logged in to use AI features.");

       const response = await fetch('/api/generateQuiz', {
          method: 'POST',
          headers: {
             'Content-Type': 'application/json',
             'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ subject, topic, difficulty, questionCount })
       });

       if (!response.ok) {
          const err = await response.json();
          throw new Error(err.error || "Quiz generation failed");
       }

       return await response.json();
    },

    /**
     * Save a quiz to Firestore
     */
    saveQuiz: async (quiz: Omit<Quiz, 'id'>): Promise<string> => {
        if (!db) throw new Error("Database not configured");
        const docRef = await addDoc(collection(db, 'quizzes'), {
            ...quiz,
            createdAt: serverTimestamp()
        });
        return docRef.id;
    },

    /**
     * Save a quiz attempt to Firestore
     */
    saveQuizAttempt: async (attempt: Omit<QuizAttempt, 'id'>): Promise<string> => {
        if (!db) throw new Error("Database not configured");
        const docRef = await addDoc(collection(db, 'quizAttempts'), {
            ...attempt,
            completedAt: serverTimestamp()
        });
        return docRef.id;
    },

    /**
     * Get user's quiz attempts
     */
    getUserQuizAttempts: async (userId: string): Promise<QuizAttempt[]> => {
        if (!db) return [];
        // Avoid scanning the entire collection (perf + privacy).
        // We also avoid composite-index requirements by sorting client-side.
        const q = query(
            collection(db, 'quizAttempts'),
            where('userId', '==', userId),
            limit(200)
        );
        const snap = await getDocs(q);
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as QuizAttempt));
        const toMillis = (t: any): number => {
            if (typeof t === 'number') return t;
            return t?.toMillis?.() ?? 0;
        };
        return list.sort((a, b) => toMillis(b.completedAt) - toMillis(a.completedAt));
    },

    // STUDY GROUPS METHODS
    
    createStudyGroup: async (groupData: Omit<StudyGroup, 'id' | 'createdAt'>): Promise<string> => {
        if (!db) throw new Error("Database not configured");
        const docRef = await withTimeout(
            addDoc(collection(db, 'studyGroups'), {
                ...groupData,
                createdAt: serverTimestamp()
            }),
            10000
        );
        return docRef.id;
    },

    updateStudyGroup: async (groupId: string, data: Partial<StudyGroup>) => {
        if (!db) throw new Error("Database not configured");
        const docRef = doc(db, 'studyGroups', groupId);
        return withTimeout(updateDoc(docRef, data), 5000);
    },

    deleteStudyGroup: async (groupId: string) => {
        if (!db) throw new Error("Database not configured");
        const docRef = doc(db, 'studyGroups', groupId);
        return withTimeout(deleteDoc(docRef), 5000);
    },

    joinStudyGroup: async (groupId: string, userId: string) => {
        if (!db) throw new Error("Database not configured");
        const docRef = doc(db, 'studyGroups', groupId);
        return withTimeout(updateDoc(docRef, {
            members: arrayUnion(userId)
        }), 5000);
    },

    leaveStudyGroup: async (groupId: string, userId: string) => {
        if (!db) throw new Error("Database not configured");
        const docRef = doc(db, 'studyGroups', groupId);
        return withTimeout(updateDoc(docRef, {
            members: arrayRemove(userId)
        }), 5000);
    },

    getStudyGroup: async (groupId: string): Promise<StudyGroup | null> => {
        if (!db) return null;
        const docRef = doc(db, 'studyGroups', groupId);
        const docSnap = await withTimeout(getDoc(docRef), 5000);
        if (docSnap.exists()) {
            return { id: docSnap.id, ...docSnap.data() } as StudyGroup;
        }
        return null;
    },

    onStudyGroupsChanged: (cb: (groups: StudyGroup[]) => void, userId?: string) => {
        if (!db) { cb([]); return () => {}; }
        let q;
        if (userId) {
            // Filter groups where user is a member
            q = query(
                collection(db, 'studyGroups'),
                where('members', 'array-contains', userId),
                orderBy('createdAt', 'desc')
            );
        } else {
            // Get all public groups
            q = query(
                collection(db, 'studyGroups'),
                where('isPrivate', '==', false),
                orderBy('createdAt', 'desc')
            );
        }
        return onSnapshot(q, (snap) => {
            const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as StudyGroup));
            cb(list);
        });
    },

    // MESSAGES METHODS

    sendMessage: async (groupId: string, messageData: Omit<Message, 'id' | 'timestamp'>): Promise<string> => {
        if (!db) throw new Error("Database not configured");
        const docRef = await withTimeout(
            addDoc(collection(db, `studyGroups/${groupId}/messages`), {
                ...messageData,
                timestamp: serverTimestamp()
            }),
            10000
        );
        return docRef.id;
    },

    updateMessage: async (groupId: string, messageId: string, content: string) => {
        if (!db) throw new Error("Database not configured");
        const docRef = doc(db, `studyGroups/${groupId}/messages`, messageId);
        return withTimeout(updateDoc(docRef, {
            content,
            edited: true,
            editedAt: serverTimestamp()
        }), 5000);
    },

    deleteMessage: async (groupId: string, messageId: string) => {
        if (!db) throw new Error("Database not configured");
        const docRef = doc(db, `studyGroups/${groupId}/messages`, messageId);
        return withTimeout(deleteDoc(docRef), 5000);
    },

    onMessagesChanged: (groupId: string, cb: (messages: Message[]) => void, limitCount: number = 50) => {
        if (!db) { cb([]); return () => {}; }
        const q = query(
            collection(db, `studyGroups/${groupId}/messages`),
            orderBy('timestamp', 'desc'),
            limit(limitCount)
        );
        return onSnapshot(q, (snap) => {
            const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as Message)).reverse();
            cb(list);
        });
    },

    // SESSIONS METHODS

    createSession: async (groupId: string, sessionData: Omit<Session, 'id'>): Promise<string> => {
        if (!db) throw new Error("Database not configured");
        const docRef = await withTimeout(
            addDoc(collection(db, `studyGroups/${groupId}/sessions`), sessionData),
            10000
        );
        return docRef.id;
    },

    updateSession: async (groupId: string, sessionId: string, data: Partial<Session>) => {
        if (!db) throw new Error("Database not configured");
        const docRef = doc(db, `studyGroups/${groupId}/sessions`, sessionId);
        return withTimeout(updateDoc(docRef, data), 5000);
    },

    deleteSession: async (groupId: string, sessionId: string) => {
        if (!db) throw new Error("Database not configured");
        const docRef = doc(db, `studyGroups/${groupId}/sessions`, sessionId);
        return withTimeout(deleteDoc(docRef), 5000);
    },

    onSessionsChanged: (groupId: string, cb: (sessions: Session[]) => void) => {
        if (!db) { cb([]); return () => {}; }
        const q = query(
            collection(db, `studyGroups/${groupId}/sessions`),
            orderBy('scheduledAt', 'asc')
        );
        return onSnapshot(q, (snap) => {
            const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as Session));
            cb(list);
        });
    },

    // COLLABORATIVE NOTES METHODS

    createNote: async (groupId: string, noteData: Omit<CollaborativeNote, 'id'>): Promise<string> => {
        if (!db) throw new Error("Database not configured");
        const docRef = await withTimeout(
            addDoc(collection(db, `studyGroups/${groupId}/notes`), noteData),
            10000
        );
        return docRef.id;
    },

    updateNote: async (groupId: string, noteId: string, content: string, userId: string, userName: string) => {
        if (!db) throw new Error("Database not configured");
        const docRef = doc(db, `studyGroups/${groupId}/notes`, noteId);
        return withTimeout(updateDoc(docRef, {
            content,
            lastEditedBy: userId,
            lastEditedByName: userName,
            lastEditedAt: serverTimestamp()
        }), 5000);
    },

    deleteNote: async (groupId: string, noteId: string) => {
        if (!db) throw new Error("Database not configured");
        const docRef = doc(db, `studyGroups/${groupId}/notes`, noteId);
        return withTimeout(deleteDoc(docRef), 5000);
    },

    onNotesChanged: (groupId: string, cb: (notes: CollaborativeNote[]) => void) => {
        if (!db) { cb([]); return () => {}; }
        const q = query(
            collection(db, `studyGroups/${groupId}/notes`),
            orderBy('lastEditedAt', 'desc')
        );
        return onSnapshot(q, (snap) => {
            const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as CollaborativeNote));
            cb(list);
        });
    }
};

export { auth, db, isConfigured };