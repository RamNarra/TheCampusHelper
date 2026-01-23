import { 
  onAuthStateChanged,
  User,
    type Auth
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
    writeBatch,
  arrayUnion,
  arrayRemove,
  Firestore,
  FieldValue
} from 'firebase/firestore';
import type { DocumentData } from 'firebase/firestore';
import { UserProfile, Resource, Quiz, QuizAttempt, QuizQuestion, StudyGroup, Message, Session, CollaborativeNote, ResourceInteraction, UserRole, TodoItem, Habit, StudyGroupRequest } from '../types';
import { normalizeRole } from '../lib/rbac';
import { env, getAuthClient, getDb, getGoogleProvider, isConfigured } from './platform/firebaseClient';
import { stripUndefined, withTimeout } from './platform/utils';
import { getPhase1ServerlessOnly } from './platform/phase1Toggle';
import { authService, moderationService, usersService, presenceService } from './domains';

// --- CONFIGURATION ---
const DEFAULT_INTERACTION_DAYS = 30; // Default time window for fetching interactions

// Platform-owned initialization.
const auth = getAuthClient() as Auth | undefined;
const db = getDb() as Firestore | undefined;
const googleProvider = getGoogleProvider();

const sanitizeStorageFilename = (name: string): string => {
    const trimmed = (name || '').trim() || 'file';
    // Prevent path traversal and keep filenames readable.
    const noSlashes = trimmed.replace(/[\\/]+/g, '_');
    const cleaned = noSlashes.replace(/[^a-zA-Z0-9._\-]+/g, '_');
    const noEdgeDots = cleaned.replace(/^\.+|\.+$/g, '');
    const safe = noEdgeDots || 'file';
    return safe.slice(0, 120);
};

const inferContentTypeFromFilename = (filename: string): string | undefined => {
    const lower = (filename || '').toLowerCase();
    if (lower.endsWith('.pdf')) return 'application/pdf';
    if (lower.endsWith('.pptx')) {
        return 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
    }
    if (lower.endsWith('.ppt')) return 'application/vnd.ms-powerpoint';
    return undefined;
};

const getCloudinaryConfig = () => {
    const cloudName = (env.VITE_CLOUDINARY_CLOUD_NAME || '').trim();
    const uploadPreset = (env.VITE_CLOUDINARY_UPLOAD_PRESET || '').trim();
    return { cloudName, uploadPreset };
};

const uploadToCloudinaryRaw = async (params: {
    file: File;
    folder?: string;
    publicId?: string;
}): Promise<{ downloadUrl: string; storagePath: string }> => {
    const { cloudName, uploadPreset } = getCloudinaryConfig();
    if (!cloudName || !uploadPreset) {
        throw new Error('File upload is not configured. Missing VITE_CLOUDINARY_CLOUD_NAME / VITE_CLOUDINARY_UPLOAD_PRESET.');
    }

    const file = params.file;
    const maxBytes = 20 * 1024 * 1024; // 20MB
    if (!file) throw new Error('Upload failed: missing file');
    if (file.size > maxBytes) throw new Error('Upload failed: file is too large (max 20MB)');

    // Accept only PDFs/PPT/PPTX for raw uploads.
    const nameLower = (file.name || '').toLowerCase();
    const isPdf = nameLower.endsWith('.pdf') || file.type === 'application/pdf';
    const isPptx =
        nameLower.endsWith('.pptx') ||
        file.type === 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
    const isPpt = nameLower.endsWith('.ppt') || file.type === 'application/vnd.ms-powerpoint';
    if (!isPdf && !isPptx && !isPpt) throw new Error('Upload failed: unsupported file type');

    const url = `https://api.cloudinary.com/v1_1/${encodeURIComponent(cloudName)}/raw/upload`;

    const fd = new FormData();
    fd.append('file', params.file);
    fd.append('upload_preset', uploadPreset);
    if (params.folder) fd.append('folder', params.folder);
    if (params.publicId) fd.append('public_id', params.publicId);

    const res = await withTimeout(fetch(url, { method: 'POST', body: fd }), 60000);
    if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`Upload failed (${res.status}). ${text || ''}`.trim());
    }
    const json = (await res.json()) as any;
    const secureUrl = json?.secure_url || json?.url;
    const publicId = json?.public_id || '';
    if (!secureUrl) throw new Error('Upload failed: missing URL from provider');
    return { downloadUrl: secureUrl, storagePath: publicId || secureUrl };
};

// --- SECURE HELPERS (re-exported for backwards compatibility) ---
export const getAuthToken = authService.getAuthToken;
export const forceRefreshAuthToken = authService.forceRefreshAuthToken;

export const extractDriveId = (url: string): string | null => {
  if (!url) return null;
  const match = url.match(/[-\w]{25,}/);
  return match ? match[0] : null;
};

export const mapAuthToProfile = (user: User): UserProfile => {
  return {
    uid: user.uid,
    displayName: user.displayName,
    email: user.email,
    photoURL: user.photoURL,
        // Never trust client env allowlists for authorization.
        // Real roles come from Firestore + custom claims.
        role: 'student',
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
        return authService.signIn();
    },

    signOut: async () => {
        return authService.signOutUser();
    },

    // PROFILE METHODS (Direct Firestore Access via Rules)
    updateProfile: async (uid: string, data: Partial<UserProfile>) => {
        return usersService.updateProfile(uid, data);
    },

    getAllUsers: async (): Promise<UserProfile[]> => {
        return usersService.getAllUsers(200);
    },

    bootstrapAdminAccess: async (): Promise<boolean> => {
        return moderationService.bootstrapAdminAccess();
    },

        bootstrapAdminAccessDetailed: async (): Promise<{ ok: boolean; status: number; bodyText: string }> => {
            return moderationService.bootstrapAdminAccessDetailed();
        },

        forceRefreshAuthToken: async (): Promise<void> => {
            await forceRefreshAuthToken();
        },

    updateUserRole: async (targetUid: string, role: UserRole) => {
        return moderationService.updateUserRole(targetUid, role);
    },

    setUserDisabled: async (targetUid: string, disabled: boolean) => {
        return moderationService.setUserDisabled(targetUid, disabled);
    },

    // RESOURCE METHODS
    addResource: async (resource: Omit<Resource, 'id'>, options?: { id?: string }): Promise<string> => {
        if (!db) throw new Error("Database not configured");

        const fallbackOwnerId = auth?.currentUser?.uid;
        const ownerId = resource.ownerId || fallbackOwnerId;
        if (!ownerId) throw new Error('You must be signed in to upload a resource.');

        // Client should default to pending; staff can approve via moderation tools.
        // Firestore rules enforce this as the source of truth.
        const status = resource.status || 'pending';

                const payload = stripUndefined({
                    ...resource,
                    ownerId,
                    status,
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp(),
                } as any);

                const usePhase1 = await getPhase1ServerlessOnly();
                if (usePhase1) {
                    const token = await getAuthToken();
                    if (!token) throw new Error('Not signed in');

                    const res = await withTimeout(
                        fetch('/api/resources/submit', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                Authorization: `Bearer ${token}`,
                            },
                            body: JSON.stringify({
                                title: payload.title,
                                subject: payload.subject,
                                branch: payload.branch,
                                semester: payload.semester,
                                unit: payload.unit,
                                type: payload.type,
                                downloadUrl: payload.downloadUrl,
                                driveFileId: payload.driveFileId,
                            }),
                        }),
                        15000
                    );

                    if (!res.ok) {
                        const text = await res.text().catch(() => '');
                        throw new Error(text || `Submit resource failed (${res.status})`);
                    }

                    const json = (await res.json().catch(() => ({}))) as any;
                    const resourceId = String(json?.resourceId || '').trim();
                    if (!resourceId) throw new Error('Submit resource failed: missing resourceId');
                    return resourceId;
                }

                if (options?.id) {
                    const docRef = doc(collection(db, 'resources'), options.id);
                    await withTimeout(setDoc(docRef, payload as any), 15000);
                    return docRef.id;
                }

                const docRef = await withTimeout(addDoc(collection(db, 'resources'), payload as any), 15000);
                return docRef.id;
    },

        uploadResourceFile: async (params: {
            uid: string;
            resourceId: string;
            file: File;
        }): Promise<{ downloadUrl: string; storagePath: string }> => {
            if (!params.uid) throw new Error('Missing uid');
            if (!params.resourceId) throw new Error('Missing resourceId');
            if (!params.file) throw new Error('Missing file');

            const filename = sanitizeStorageFilename(params.file.name);
            const contentType = params.file.type || inferContentTypeFromFilename(filename);

            // Keep validation in client even though provider also enforces restrictions via preset.
            if (!contentType) throw new Error('Unsupported file type. Only PDF/PPTX are allowed.');
            if (
                contentType !== 'application/pdf' &&
                contentType !== 'application/vnd.openxmlformats-officedocument.presentationml.presentation' &&
                contentType !== 'application/vnd.ms-powerpoint'
            ) {
                throw new Error('Only PDF and PPTX files are allowed for now.');
            }

            return uploadToCloudinaryRaw({
                file: params.file,
                folder: `resources/${params.uid}`,
                publicId: `${params.resourceId}/${filename}`,
            });
        },

    // --- TO-DO / HABITS ---
    clearAllTodos: async (uid: string): Promise<number> => {
        if (!db) throw new Error('Database not configured');
        const col = collection(doc(db, 'users', uid), 'todoItems');
        let deleted = 0;
        const batchSize = 250;

        while (true) {
            const snap = await withTimeout(getDocs(query(col, limit(batchSize))), 15000);
            if (snap.empty) break;

            const batch = writeBatch(db);
            for (const d of snap.docs) {
                batch.delete(d.ref);
            }
            await withTimeout(batch.commit(), 15000);
            deleted += snap.size;

            if (snap.size < batchSize) break;
        }

        return deleted;
    },

    clearAllHabits: async (uid: string): Promise<number> => {
        if (!db) throw new Error('Database not configured');
        const col = collection(doc(db, 'users', uid), 'habits');
        let deleted = 0;
        const batchSize = 250;

        while (true) {
            const snap = await withTimeout(getDocs(query(col, limit(batchSize))), 15000);
            if (snap.empty) break;

            const batch = writeBatch(db);
            for (const d of snap.docs) {
                batch.delete(d.ref);
            }
            await withTimeout(batch.commit(), 15000);
            deleted += snap.size;

            if (snap.size < batchSize) break;
        }

        return deleted;
    },

    rolloverIncompleteTodosFromRange: async (uid: string, fromStartDate: string, fromEndDate: string): Promise<number> => {
        if (!db) throw new Error('Database not configured');

        const MAX_ROLLOVER = 200;

        const toISODate = (d: Date): string => {
            const pad2 = (n: number) => String(n).padStart(2, '0');
            return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
        };
        const addDays = (iso: string, days: number): string => {
            const d = new Date(`${iso}T00:00:00`);
            d.setDate(d.getDate() + days);
            return toISODate(d);
        };

        const col = collection(doc(db, 'users', uid), 'todoItems');
        const snap = await withTimeout(
            getDocs(
                query(
                    col,
                    where('date', '>=', fromStartDate),
                    where('date', '<=', fromEndDate),
                    orderBy('date', 'asc'),
                    limit(2000)
                )
            ),
            15000
        );

        const items = snap.docs.map(d => ({ id: d.id, ...d.data() } as TodoItem));
        const incompletes = items.filter(t => !t.completed).slice(0, MAX_ROLLOVER);
        if (incompletes.length === 0) return 0;

        let created = 0;
        const chunkSize = 250;
        for (let i = 0; i < incompletes.length; i += chunkSize) {
            const chunk = incompletes.slice(i, i + chunkSize);
            const batch = writeBatch(db);

            for (const t of chunk) {
                const newDate = addDays(t.date, 7);
                const ref = doc(col);
                batch.set(ref, {
                    uid,
                    date: newDate,
                    title: t.title,
                    completed: false,
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp(),
                } as any);
            }

            await withTimeout(batch.commit(), 20000);
            created += chunk.length;
        }

        return created;
    },

    onTodoItemsChanged: (
        uid: string,
        startDate: string,
        endDate: string,
        cb: (items: TodoItem[]) => void,
        onError?: (e: unknown) => void
    ) => {
        if (!db) { cb([]); return () => {}; }
        const q = query(
            collection(doc(db, 'users', uid), 'todoItems'),
            where('date', '>=', startDate),
            where('date', '<=', endDate),
            orderBy('date', 'asc'),
            limit(2000)
        );
        return onSnapshot(
            q,
            (snap) => {
                const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as TodoItem));
                cb(list);
            },
            (err) => {
                onError?.(err);
            }
        );
    },

    addTodo: async (params: { uid: string; date: string; title: string }): Promise<string> => {
        if (!db) throw new Error('Database not configured');
        const payload = stripUndefined({
            uid: params.uid,
            date: params.date,
            title: params.title,
            completed: false,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
        } as any);
        const ref = await withTimeout(addDoc(collection(doc(db, 'users', params.uid), 'todoItems'), payload as any), 15000);
        return ref.id;
    },

    setTodoCompleted: async (uid: string, todoId: string, completed: boolean): Promise<void> => {
        if (!db) throw new Error('Database not configured');
        const ref = doc(db, 'users', uid, 'todoItems', todoId);
        await withTimeout(updateDoc(ref, { completed, updatedAt: serverTimestamp() }), 8000);
    },

    deleteTodo: async (uid: string, todoId: string): Promise<void> => {
        if (!db) throw new Error('Database not configured');
        await withTimeout(deleteDoc(doc(db, 'users', uid, 'todoItems', todoId)), 8000);
    },

    onHabitsChanged: (uid: string, cb: (items: Habit[]) => void, onError?: (e: unknown) => void) => {
        if (!db) { cb([]); return () => {}; }
        const q = query(collection(doc(db, 'users', uid), 'habits'), orderBy('createdAt', 'asc'), limit(100));
        return onSnapshot(
            q,
            (snap) => {
                const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as Habit));
                cb(list);
            },
            (err) => {
                onError?.(err);
            }
        );
    },

    addHabit: async (params: { uid: string; name: string }): Promise<string> => {
        if (!db) throw new Error('Database not configured');
        const payload = stripUndefined({
            uid: params.uid,
            name: params.name,
            completions: {},
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
        } as any);
        const ref = await withTimeout(addDoc(collection(doc(db, 'users', params.uid), 'habits'), payload as any), 15000);
        return ref.id;
    },

    setHabitCompletion: async (uid: string, habitId: string, date: string, completed: boolean): Promise<void> => {
        if (!db) throw new Error('Database not configured');
        const ref = doc(db, 'users', uid, 'habits', habitId);
        const key = `completions.${date}`;
        await withTimeout(updateDoc(ref, { [key]: completed, updatedAt: serverTimestamp() } as any), 8000);
    },

    // SUBSCRIPTIONS
    onAuthStateChanged: (cb: (user: User | null) => void) => {
        return authService.onAuthChanged(cb);
    },

    onProfileChanged: (uid: string, cb: (data: DocumentData | undefined) => void) => {
        return usersService.onProfileChanged(uid, cb);
    },

    // --- PRESENCE ---
    setPresenceOnline: async (uid: string, profile?: { displayName?: string | null; photoURL?: string | null }) => {
        return presenceService.setOnline(uid, profile);
    },

    setPresenceIdle: async (uid: string, profile?: { displayName?: string | null; photoURL?: string | null }) => {
        return presenceService.setIdle(uid, profile);
    },

    setPresenceOffline: async (uid: string) => {
        return presenceService.setOffline(uid);
    },

    onPresenceByUserIds: (userIds: string[], cb: (records: Record<string, DocumentData>) => void) => {
        return presenceService.onPresenceByUserIds(userIds, cb);
    },

    // --- STUDY GROUP REQUESTS (ADMIN APPROVAL FLOW) ---
    createStudyGroupRequest: async (data: {
        name: string;
        purpose: string;
        subject: string;
        visibleToYears: string[];
        requestedBy: string;
        requestedByName: string;
    }): Promise<string> => {
        if (!db) throw new Error('Database not configured');
        const payload = stripUndefined({
            name: data.name,
            purpose: data.purpose,
            subject: data.subject,
            visibleToYears: data.visibleToYears,
            requestedBy: data.requestedBy,
            requestedByName: data.requestedByName,
            status: 'pending',
            createdAt: serverTimestamp(),
        } as any);
        const ref = await withTimeout(addDoc(collection(db, 'studyGroupRequests'), payload as any), 10000);
        return ref.id;
    },

    onMyStudyGroupRequestsChanged: (uid: string, cb: (items: StudyGroupRequest[]) => void) => {
        if (!db) { cb([]); return () => {}; }
        const q = query(collection(db, 'studyGroupRequests'), where('requestedBy', '==', uid), limit(200));
        return onSnapshot(q, (snap) => {
            const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as StudyGroupRequest));
            cb(list);
        });
    },

    onPendingStudyGroupRequestsChanged: (cb: (items: StudyGroupRequest[]) => void) => {
        if (!db) { cb([]); return () => {}; }
        const q = query(collection(db, 'studyGroupRequests'), where('status', '==', 'pending'), limit(200));
        return onSnapshot(q, (snap) => {
            const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as StudyGroupRequest));
            cb(list);
        });
    },

    approveStudyGroupRequest: async (requestId: string) => {
        return moderationService.approveStudyGroupRequest(requestId);
    },

    rejectStudyGroupRequest: async (requestId: string, reason?: string) => {
        return moderationService.rejectStudyGroupRequest(requestId, reason);
    },

    // --- STUDY GROUP CHAT ATTACHMENTS ---
    uploadStudyGroupAttachment: async (groupId: string, file: File) => {
        const safeName = sanitizeStorageFilename(file.name || 'file');
        const folder = `study-groups/${sanitizeStorageFilename(String(groupId || 'group'))}`;
        return uploadToCloudinaryRaw({
            file,
            folder,
            publicId: `${Date.now()}-${safeName}`
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
        const usePhase1 = await getPhase1ServerlessOnly();
        if (usePhase1) {
            const token = await getAuthToken();
            if (!token) throw new Error('Not signed in');
            const res = await withTimeout(
                fetch('/api/resources/setStatus', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${token}`,
                    },
                    body: JSON.stringify({
                        resourceId,
                        status,
                        rejectionReason: options?.rejectionReason ?? '',
                    }),
                }),
                10000
            );
            if (!res.ok) {
                const text = await res.text().catch(() => '');
                throw new Error(text || `Update status failed (${res.status})`);
            }
            return;
        }
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
        const usePhase1 = await getPhase1ServerlessOnly();
        const token = await getAuthToken();

        // Prefer server-authoritative delete (works even when client deletes are blocked by rules).
        if (token) {
            try {
                const res = await withTimeout(
                    fetch('/api/resources/delete', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            Authorization: `Bearer ${token}`,
                        },
                        body: JSON.stringify({ resourceId }),
                    }),
                    10000
                );
                if (!res.ok) {
                    const text = await res.text().catch(() => '');
                    throw new Error(text || `Delete failed (${res.status})`);
                }
                return;
            } catch (e) {
                // If Phase1 is on, deletion is intentionally server-only.
                if (usePhase1) throw e;
                // Otherwise fall back to legacy direct Firestore delete.
            }
        }

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
            // Keep this as a safe no-op unless an authorized role is signed in.
            const user = auth?.currentUser;
            if (!user) return [];
            let claims: any;
            try {
                const tokenResult = await user.getIdTokenResult();
                claims = tokenResult?.claims || {};
            } catch {
                return [];
            }

            const role = normalizeRole(claims?.role || (claims?.admin === true ? 'admin' : undefined));
            if (!(role === 'super_admin' || role === 'admin' || role === 'moderator')) return [];

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

             const parseApiError = async (response: Response): Promise<{ message: string; requestId?: string }> => {
                 const status = response.status;

                 // Common dev pitfall: Vite-only dev server.
                 if (status === 404) {
                     return {
                         message:
                             'AI backend is not available. In local dev, run "npm run dev:secure" (Vercel dev) so /api routes work.',
                     };
                 }

                 if (status === 429) {
                     return { message: 'You are sending requests too quickly. Please wait a minute and try again.' };
                 }

                 try {
                     const err = (await response.json().catch(() => null)) as any;
                     const requestId = typeof err?.requestId === 'string' ? err.requestId : undefined;
                     const message = (err?.error || err?.message || '').toString().trim();
                     if (message) return { message, requestId };
                     return { message: `Request failed (${status})`, requestId };
                 } catch {
                     // Non-JSON error body.
                     return { message: `Request failed (${status})` };
                 }
             };

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
                    const err = await parseApiError(response);
                    const suffix = err.requestId ? ` (requestId: ${err.requestId})` : '';
                    throw new Error(`${err.message || 'Generation failed'}${suffix}`);
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
                    // Keep error messaging consistent with generateContent.
                    let message = 'Quiz generation failed';
                    let requestId: string | undefined;

                    if (response.status === 404) {
                        message = 'Quiz backend is not available. In local dev, run "npm run dev:secure" (Vercel dev) so /api routes work.';
                    } else if (response.status === 429) {
                        message = 'You are sending requests too quickly. Please wait a minute and try again.';
                    } else {
                        try {
                            const err = (await response.json().catch(() => null)) as any;
                            requestId = typeof err?.requestId === 'string' ? err.requestId : undefined;
                            message = (err?.error || err?.message || message).toString();
                        } catch {
                            // ignore
                        }
                    }

                    const suffix = requestId ? ` (requestId: ${requestId})` : '';
                    throw new Error(`${message}${suffix}`);
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
        const usePhase1 = await getPhase1ServerlessOnly();
        if (usePhase1) {
            const token = await getAuthToken();
            if (!token) throw new Error('Not signed in');
            const res = await withTimeout(
                fetch('/api/studyGroups/join', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${token}`,
                    },
                    body: JSON.stringify({ groupId }),
                }),
                15000
            );
            if (!res.ok) {
                const text = await res.text().catch(() => '');
                throw new Error(text || `Join failed (${res.status})`);
            }
            return;
        }
        const docRef = doc(db, 'studyGroups', groupId);
        return withTimeout(updateDoc(docRef, {
            members: arrayUnion(userId)
        }), 5000);
    },

    leaveStudyGroup: async (groupId: string, userId: string) => {
        if (!db) throw new Error("Database not configured");
        const usePhase1 = await getPhase1ServerlessOnly();
        if (usePhase1) {
            const token = await getAuthToken();
            if (!token) throw new Error('Not signed in');
            const res = await withTimeout(
                fetch('/api/studyGroups/leave', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${token}`,
                    },
                    body: JSON.stringify({ groupId }),
                }),
                15000
            );
            if (!res.ok) {
                const text = await res.text().catch(() => '');
                throw new Error(text || `Leave failed (${res.status})`);
            }
            return;
        }
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

    onStudyGroupsChanged: (cb: (groups: StudyGroup[]) => void, userId?: string, userYear?: string) => {
        if (!db) { cb([]); return () => {}; }
        let q;
        if (userId) {
            // Filter groups where user is a member
            q = query(
                collection(db, 'studyGroups'),
                where('members', 'array-contains', userId)
            );
        } else {
            // Discover: only groups visible to the current user's year.
            // Important: queries must not include docs that rules would reject.
            const year = (userYear || '').trim();
            if (!year) {
                cb([]);
                return () => {};
            }
            q = query(
                collection(db, 'studyGroups'),
                where('visibleToYears', 'array-contains', year)
            );
        }
        return onSnapshot(
            q,
            (snap) => {
                const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as StudyGroup));

                // Avoid requiring a composite index by sorting client-side.
                // createdAt is typically a Firestore Timestamp.
                const toMillis = (t: any): number => {
                    if (!t) return 0;
                    if (typeof t === 'number') return t;
                    return t?.toMillis?.() ?? 0;
                };
                list.sort((a: any, b: any) => toMillis(b.createdAt) - toMillis(a.createdAt));

                cb(list);
            },
            (err) => {
                console.error('onStudyGroupsChanged snapshot error:', err);
                cb([]);
            }
        );
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
        const usePhase1 = await getPhase1ServerlessOnly();
        if (usePhase1) {
            const token = await getAuthToken();
            if (!token) throw new Error('Not signed in');
            const toMillis = (v: any): number => {
                if (typeof v === 'number') return v;
                return v?.toMillis?.() ?? (v instanceof Date ? v.getTime() : 0);
            };
            const res = await withTimeout(
                fetch('/api/studyGroups/createSession', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${token}`,
                    },
                    body: JSON.stringify({
                        groupId,
                        title: (sessionData as any).title,
                        description: (sessionData as any).description,
                        scheduledAtMillis: toMillis((sessionData as any).scheduledAt),
                        duration: (sessionData as any).duration,
                        videoUrl: (sessionData as any).videoUrl,
                        status: (sessionData as any).status,
                    }),
                }),
                15000
            );
            if (!res.ok) {
                const text = await res.text().catch(() => '');
                throw new Error(text || `Create session failed (${res.status})`);
            }
            const json = (await res.json().catch(() => ({}))) as any;
            const sessionId = String(json?.sessionId || '').trim();
            if (!sessionId) throw new Error('Create session failed: missing sessionId');
            return sessionId;
        }
        const docRef = await withTimeout(
            addDoc(collection(db, `studyGroups/${groupId}/sessions`), sessionData),
            10000
        );
        return docRef.id;
    },

    updateSession: async (groupId: string, sessionId: string, data: Partial<Session>) => {
        if (!db) throw new Error("Database not configured");
        const usePhase1 = await getPhase1ServerlessOnly();
        if (usePhase1) {
            const token = await getAuthToken();
            if (!token) throw new Error('Not signed in');
            const toMillis = (v: any): number | undefined => {
                if (v === undefined) return undefined;
                if (typeof v === 'number') return v;
                return v?.toMillis?.() ?? (v instanceof Date ? v.getTime() : undefined);
            };
            const scheduledAtMillis = toMillis((data as any).scheduledAt);
            const res = await withTimeout(
                fetch('/api/studyGroups/updateSession', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${token}`,
                    },
                    body: JSON.stringify({
                        groupId,
                        sessionId,
                        title: (data as any).title,
                        description: (data as any).description,
                        scheduledAtMillis,
                        duration: (data as any).duration,
                        videoUrl: (data as any).videoUrl,
                        status: (data as any).status,
                    }),
                }),
                15000
            );
            if (!res.ok) {
                const text = await res.text().catch(() => '');
                throw new Error(text || `Update session failed (${res.status})`);
            }
            return;
        }
        const docRef = doc(db, `studyGroups/${groupId}/sessions`, sessionId);
        return withTimeout(updateDoc(docRef, data), 5000);
    },

    deleteSession: async (groupId: string, sessionId: string) => {
        if (!db) throw new Error("Database not configured");
        const usePhase1 = await getPhase1ServerlessOnly();
        if (usePhase1) {
            const token = await getAuthToken();
            if (!token) throw new Error('Not signed in');
            const res = await withTimeout(
                fetch('/api/studyGroups/deleteSession', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${token}`,
                    },
                    body: JSON.stringify({ groupId, sessionId }),
                }),
                15000
            );
            if (!res.ok) {
                const text = await res.text().catch(() => '');
                throw new Error(text || `Delete session failed (${res.status})`);
            }
            return;
        }
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