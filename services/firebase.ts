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
  orderBy, 
  where,
  limit,
  onSnapshot, 
  serverTimestamp,
  updateDoc,
  deleteDoc,
  arrayUnion,
  arrayRemove,
  Firestore
} from 'firebase/firestore';
import type { DocumentData } from 'firebase/firestore';
import { UserProfile, Resource, StudyGroup, Message, Session, CollaborativeNote } from '../types';

// --- CONFIGURATION ---
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
    year: undefined
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

    // RESOURCE METHODS
    addResource: async (resource: Omit<Resource, 'id'>) => {
        if (!db) throw new Error("Database not configured");
        return withTimeout(
            addDoc(collection(db, 'resources'), {
                ...resource,
                createdAt: serverTimestamp()
            }), 
            15000
        );
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

    onResourcesChanged: (cb: (resources: Resource[]) => void) => {
        if (!db) { cb([]); return () => {}; }
        const q = query(collection(db, 'resources'), orderBy('createdAt', 'desc'));
        return onSnapshot(q, (snap) => {
            const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as Resource));
            cb(list);
        });
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
        const docSnap = await getDoc(docRef);
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