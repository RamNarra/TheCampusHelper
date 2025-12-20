import React, { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { collection, limit, onSnapshot, orderBy, query } from 'firebase/firestore';
import {
  Users,
  Plus,
  Search,
  X,
  MessageSquare,
  Video,
  FileText,
  Calendar,
  UserPlus,
  Send,
  Compass,
  Paperclip,
  Mic,
  Square,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/firebase';
import { safeExternalHttpUrl } from '../lib/utils';
import { StudyGroup, Message, Session, CollaborativeNote } from '../types';
import AdUnit from '../components/AdUnit';
import { isAuthBypassed } from '../lib/dev';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { EmptyState as UiEmptyState } from '../components/ui/EmptyState';
import { Spinner } from '../components/ui/Spinner';
import { getDb } from '../services/platform/firebaseClient';

// Helper function to format Firestore timestamps
const formatTimestamp = (timestamp: any, format: 'time' | 'date' | 'datetime' = 'datetime'): string => {
  if (!timestamp?.toDate) return '';
  const date = timestamp.toDate();
  if (format === 'time') return date.toLocaleTimeString();
  if (format === 'date') return date.toLocaleDateString();
  return date.toLocaleString();
};

const StudyGroupsPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isPreview = !user && isAuthBypassed();
  const [myGroups, setMyGroups] = useState<StudyGroup[]>([]);
  const [publicGroups, setPublicGroups] = useState<StudyGroup[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [isDiscover, setIsDiscover] = useState(false);
  const [activeChannel, setActiveChannel] = useState<'chat' | 'sessions' | 'notes'>('chat');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);

  const [messages, setMessages] = useState<Message[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [notes, setNotes] = useState<CollaborativeNote[]>([]);
  const [presenceByUid, setPresenceByUid] = useState<Record<string, any>>({});
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);

  const [latestMessageByGroupId, setLatestMessageByGroupId] = useState<Record<string, number>>({});

  const didAutoDiscoverRef = useRef(false);

  useEffect(() => {
    if (!user) {
      if (isPreview) {
        setLoading(false);
        setMyGroups([]);
        setPublicGroups([]);
        setSelectedGroupId(null);
        setIsDiscover(true);
      }
      return;
    }

    // Subscribe to user's groups
    const unsubscribeMyGroups = api.onStudyGroupsChanged((groups) => {
      setMyGroups(groups);
      setLoading(false);
    }, user.uid);

    // Subscribe to discoverable public groups (year-scoped)
    const unsubscribePublic = api.onStudyGroupsChanged(
      (groups) => {
        setPublicGroups(groups.filter(g => !g.members.includes(user.uid)));
      },
      undefined,
      user.year
    );

    return () => {
      unsubscribeMyGroups();
      unsubscribePublic();
    };
  }, [user]);

  useEffect(() => {
    if (!user) return;
    if (loading) return;
    if (isPreview) return;
    if (didAutoDiscoverRef.current) return;

    // If the account has no joined groups, default to Discover.
    if (myGroups.length === 0) {
      setIsDiscover(true);
      setSelectedGroupId(null);
      didAutoDiscoverRef.current = true;
    }
  }, [user, loading, isPreview, myGroups.length]);

  const selectedGroup = useMemo(() => {
    if (!selectedGroupId) return null;
    return myGroups.find((g) => g.id === selectedGroupId) ?? null;
  }, [myGroups, selectedGroupId]);

  const membersKey = useMemo(() => {
    if (!selectedGroup?.members?.length) return '';
    return selectedGroup.members.slice().sort().join('|');
  }, [selectedGroup]);

  useEffect(() => {
    setPresenceByUid({});
    if (!user) return;
    if (!selectedGroup) return;
    return api.onPresenceByUserIds(selectedGroup.members, setPresenceByUid);
  }, [user?.uid, selectedGroupId, membersKey]);

  const memberRows = useMemo(() => {
    if (!selectedGroup?.members?.length) return [] as Array<{ uid: string; name: string; status: 'online' | 'idle' | 'offline' }>;

    const toMillis = (t: any): number => {
      if (typeof t === 'number') return t;
      return t?.toMillis?.() ?? 0;
    };

    const computeStatus = (p: any): 'online' | 'idle' | 'offline' => {
      if (!p) return 'offline';
      const last = toMillis(p.lastSeen);
      if (!last) return 'offline';
      const age = Date.now() - last;
      if (age > 90000) return 'offline';
      return p.state === 'idle' ? 'idle' : 'online';
    };

    const rows = selectedGroup.members.map((uid) => {
      const p = presenceByUid?.[uid];
      const name = (p?.displayName as string | undefined) || (uid.length > 10 ? `${uid.slice(0, 6)}…${uid.slice(-4)}` : uid);
      return { uid, name, status: computeStatus(p) };
    });

    const rank = (s: 'online' | 'idle' | 'offline') => (s === 'online' ? 0 : s === 'idle' ? 1 : 2);
    rows.sort((a, b) => rank(a.status) - rank(b.status) || a.name.localeCompare(b.name));
    return rows;
  }, [presenceByUid, selectedGroup]);

  const memberCounts = useMemo(() => {
    const total = memberRows.length;
    const online = memberRows.filter((m) => m.status === 'online').length;
    const idle = memberRows.filter((m) => m.status === 'idle').length;
    return { total, online, idle };
  }, [memberRows]);

  // Default selection when groups load
  useEffect(() => {
    if (isDiscover) return;
    if (!selectedGroupId && myGroups.length > 0) {
      setSelectedGroupId(myGroups[0].id);
      setActiveChannel('chat');
    }
  }, [isDiscover, myGroups, selectedGroupId]);

  // Subscribe to group content when a server is selected
  useEffect(() => {
    setMessages([]);
    setSessions([]);
    setNotes([]);
    setNewMessage('');

    if (!user) return;
    if (!selectedGroupId) return;

    const unsubMessages = api.onMessagesChanged(selectedGroupId, setMessages);
    const unsubSessions = api.onSessionsChanged(selectedGroupId, setSessions);
    const unsubNotes = api.onNotesChanged(selectedGroupId, setNotes);

    return () => {
      unsubMessages();
      unsubSessions();
      unsubNotes();
    };
  }, [selectedGroupId, user]);

  const handleCreateGroup = useCallback(() => {
    if (!user) return;
    setShowCreateModal(true);
  }, []);

  const handleJoinGroup = useCallback(async (groupId: string) => {
    if (!user) return;
    try {
      await api.joinStudyGroup(groupId, user.uid);
    } catch (error) {
      console.error('Error joining group:', error);
    }
  }, [user]);

  const handleSendMessage = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!selectedGroupId) return;
    if (!newMessage.trim()) return;

    setSending(true);
    try {
      await api.sendMessage(selectedGroupId, {
        studyGroupId: selectedGroupId,
        senderId: user.uid,
        senderName: user.displayName || 'Unknown',
        senderPhotoURL: user.photoURL || undefined,
        content: newMessage.trim(),
        kind: 'text',
      });
      setNewMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setSending(false);
    }
  }, [newMessage, selectedGroupId, user]);

  const handleSendAttachment = useCallback(async (params: { file: File; kind: 'file' | 'audio' }) => {
    if (!user) return;
    if (!selectedGroupId) return;
    try {
      const uploaded = await api.uploadStudyGroupAttachment(selectedGroupId, params.file);
      await api.sendMessage(selectedGroupId, {
        studyGroupId: selectedGroupId,
        senderId: user.uid,
        senderName: user.displayName || 'Unknown',
        senderPhotoURL: user.photoURL || undefined,
        content: params.kind === 'audio' ? 'Voice message' : params.file.name,
        kind: params.kind,
        fileUrl: uploaded.downloadUrl,
        fileName: params.file.name,
        mimeType: params.file.type || undefined,
      } as any);
    } catch (error) {
      console.error('Attachment send failed:', error);
    }
  }, [selectedGroupId, user]);

  const normalizedSearch = useMemo(() => searchTerm.trim().toLowerCase(), [searchTerm]);

  const filteredMyGroups = useMemo(() => {
    if (!normalizedSearch) return myGroups;
    return myGroups.filter(group =>
      group.name.toLowerCase().includes(normalizedSearch) ||
      group.subject.toLowerCase().includes(normalizedSearch)
    );
  }, [myGroups, normalizedSearch]);

  const filteredPublicGroups = useMemo(() => {
    if (!normalizedSearch) return publicGroups;
    return publicGroups.filter(group =>
      group.name.toLowerCase().includes(normalizedSearch) ||
      group.subject.toLowerCase().includes(normalizedSearch)
    );
  }, [publicGroups, normalizedSearch]);

  // Lightweight unread indicators: subscribe to latest message per joined group.
  // This is read-only (no writes) and keeps the sidebar feeling “live”.
  useEffect(() => {
    const db = getDb();
    if (!db) return;
    if (!user) return;
    if (!myGroups.length) return;

    const unsubs = myGroups.map((g) => {
      const q = query(collection(db, `studyGroups/${g.id}/messages`), orderBy('timestamp', 'desc'), limit(1));
      return onSnapshot(
        q,
        (snap) => {
          const docSnap = snap.docs[0];
          const data = docSnap?.data() as any;
          const ts = data?.timestamp;
          const ms = typeof ts?.toMillis === 'function' ? ts.toMillis() : 0;
          if (!ms) return;
          setLatestMessageByGroupId((prev) => (prev[g.id] === ms ? prev : { ...prev, [g.id]: ms }));
        },
        () => {
          // ignore sidebar unread errors
        }
      );
    });

    return () => {
      unsubs.forEach((u) => u());
    };
  }, [myGroups, user?.uid]);

  const storageKeyForLastRead = useCallback((groupId: string) => `thc_sg_last_read_${groupId}`, []);
  const getLastReadMs = useCallback(
    (groupId: string): number => {
      try {
        const raw = sessionStorage.getItem(storageKeyForLastRead(groupId));
        const n = raw ? Number(raw) : 0;
        return Number.isFinite(n) ? n : 0;
      } catch {
        return 0;
      }
    },
    [storageKeyForLastRead]
  );
  const setLastReadMs = useCallback(
    (groupId: string, ms: number) => {
      try {
        sessionStorage.setItem(storageKeyForLastRead(groupId), String(ms));
      } catch {
        // ignore
      }
    },
    [storageKeyForLastRead]
  );

  useEffect(() => {
    if (!user) return;
    if (!selectedGroupId) return;
    // Mark as read on selection.
    setLastReadMs(selectedGroupId, Date.now());
  }, [selectedGroupId, setLastReadMs, user?.uid]);

  useEffect(() => {
    if (!user) return;
    if (!selectedGroupId) return;
    // If we're currently in the chat, keep read watermark fresh as messages arrive.
    if (activeChannel !== 'chat') return;
    if (!messages.length) return;
    setLastReadMs(selectedGroupId, Date.now());
  }, [activeChannel, messages.length, selectedGroupId, setLastReadMs, user?.uid]);

  if (!user && !isPreview) {
    return (
      <div className="flex-1 px-4 py-12 flex items-center justify-center">
        <div className="text-center">
          <Users className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-foreground mb-2">Please Sign In</h2>
          <p className="text-muted-foreground">You need to be logged in to access study groups.</p>
        </div>
      </div>
    );
  }

  const channels = [
    { id: 'chat' as const, name: 'general', icon: MessageSquare },
    { id: 'sessions' as const, name: 'sessions', icon: Video, badge: sessions.length },
    { id: 'notes' as const, name: 'notes', icon: FileText, badge: notes.length },
  ];

  const selectGroup = (groupId: string) => {
    setIsDiscover(false);
    setSelectedGroupId(groupId);
    setActiveChannel('chat');
  };

  const openDiscover = () => {
    setIsDiscover(true);
    setSelectedGroupId(null);
  };

  const showEmptySelection = !isDiscover && !selectedGroup;
  const hasServers = myGroups.length > 0;

  return (
    <div className="flex-1 min-h-0">
      <div className="h-full min-h-0 grid grid-cols-1 md:grid-cols-[320px_1fr] 2xl:grid-cols-[320px_1fr_320px]">
        {/* Sidebar */}
        <aside className="min-h-0 border-b md:border-b-0 md:border-r border-border bg-background/60 backdrop-blur">
          <div className="h-full min-h-0 flex flex-col">
            <div className="p-4 border-b border-border">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                    Study Groups
                  </div>
                  <div className="mt-1 text-sm font-semibold text-foreground truncate">
                    {isDiscover ? 'Discover' : 'My groups'}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsDiscover((v) => !v)}
                  className={`shrink-0 inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold transition-colors ${
                    isDiscover
                      ? 'border-primary/30 bg-primary/10 text-foreground'
                      : 'border-border bg-card/40 text-muted-foreground hover:text-foreground hover:bg-muted/40'
                  }`}
                >
                  <Compass className="h-4 w-4" />
                  {isDiscover ? 'Browse' : 'Discover'}
                </button>
              </div>

              <div className="mt-4 relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="h-4 w-4 text-muted-foreground" />
                </div>
                <input
                  type="text"
                  placeholder={isDiscover ? 'Search public groups…' : 'Search my groups…'}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="block w-full pl-10 pr-3 py-2 border border-border rounded-xl bg-background/60 text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/30 transition-all"
                />
              </div>

              <div className="mt-3">
                <Button
                  type="button"
                  onClick={handleCreateGroup}
                  disabled={!user}
                  className="w-full rounded-xl"
                  size="sm"
                >
                  <Plus className="h-4 w-4" />
                  Create group
                </Button>
              </div>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto p-4">
              {isDiscover ? (
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                    Public groups
                  </div>
                  {!user?.year ? (
                    <div className="mb-3 rounded-2xl border border-border bg-background/60 p-4">
                      <div className="text-sm font-semibold text-foreground">Complete your profile</div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        Public groups are filtered by your year. Add your year to see groups.
                      </div>
                      <button
                        type="button"
                        onClick={() => navigate('/profile')}
                        className="mt-3 w-full inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-card/40 px-3 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
                      >
                        <Users className="h-4 w-4" />
                        Go to Profile
                      </button>
                    </div>
                  ) : null}
                  {loading ? (
                    <div className="py-10 flex items-center justify-center gap-2 text-sm text-muted-foreground">
                      <Spinner size="sm" />
                      <span>Loading…</span>
                    </div>
                  ) : filteredPublicGroups.length > 0 ? (
                    <div className="space-y-3">
                      {filteredPublicGroups.map((group) => (
                        <GroupCard
                          key={group.id}
                          group={group}
                          onJoin={() => handleJoinGroup(group.id)}
                          isMember={false}
                          compact
                        />
                      ))}
                      <AdUnit className="mt-4" />
                    </div>
                  ) : (
                    <UiEmptyState title="No public groups found." />
                  )}
                </div>
              ) : (
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                    My groups
                  </div>
                  {loading ? (
                    <div className="py-10 flex items-center justify-center gap-2 text-sm text-muted-foreground">
                      <Spinner size="sm" />
                      <span>Loading…</span>
                    </div>
                  ) : filteredMyGroups.length > 0 ? (
                    <div className="space-y-2">
                      {filteredMyGroups.map((g) => {
                        const active = selectedGroupId === g.id && !isDiscover;
                        const latest = latestMessageByGroupId[g.id] || 0;
                        const lastRead = getLastReadMs(g.id);
                        const unread = !active && latest > 0 && latest > lastRead;
                        return (
                          <button
                            key={g.id}
                            type="button"
                            onClick={() => selectGroup(g.id)}
                            className={`w-full text-left rounded-xl border px-3 py-3 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 ${
                              active
                                ? 'border-primary/30 bg-primary/10'
                                : 'border-border bg-card/30 hover:bg-muted/40'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="flex items-center gap-2 min-w-0">
                                  <div className="font-semibold text-foreground truncate">{g.name}</div>
                                  {unread ? (
                                    <span
                                      aria-label="Unread"
                                      title="Unread"
                                      className="shrink-0 inline-flex h-2 w-2 rounded-full bg-primary"
                                    />
                                  ) : null}
                                </div>
                                <div className="mt-1 text-xs text-muted-foreground truncate">{g.subject}</div>
                              </div>
                              <div className="shrink-0 text-[11px] text-muted-foreground">
                                {g.members?.length ? `${g.members.length} members` : ''}
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-border bg-background/60 p-4">
                      <div className="text-sm font-semibold text-foreground">No groups yet</div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        Discover a public group to join, or create one.
                      </div>
                      <div className="mt-4 flex flex-col gap-2">
                        <button
                          type="button"
                          onClick={openDiscover}
                          className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-card/40 px-3 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
                        >
                          <Compass className="h-4 w-4" />
                          Discover groups
                        </button>
                        <button
                          type="button"
                          onClick={handleCreateGroup}
                          disabled={!user}
                          className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
                        >
                          <Plus className="h-4 w-4" />
                          Create group
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </aside>

        {/* Main */}
        <section className="min-h-0 flex flex-col">
          <div className="border-b border-border bg-background/60 backdrop-blur">
            <div className="px-6 py-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                    {isDiscover ? 'Explore' : 'Dashboard'}
                  </div>
                  <div className="mt-1 text-lg font-semibold text-foreground truncate">
                    {isDiscover ? 'Discover study groups' : selectedGroup?.name || 'Study groups'}
                  </div>
                  <div className="mt-1 text-sm text-muted-foreground truncate">
                    {isPreview
                      ? 'Preview mode enabled. Sign in to join and chat.'
                      : isDiscover
                        ? 'Browse public groups and join the ones you need.'
                        : selectedGroup?.subject || 'Select a group from the sidebar.'}
                  </div>
                </div>
              </div>

              {!isDiscover && selectedGroup ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  {([
                    { id: 'chat' as const, label: 'Chat', icon: MessageSquare, badge: undefined as number | undefined },
                    { id: 'sessions' as const, label: 'Sessions', icon: Video, badge: sessions.length },
                    { id: 'notes' as const, label: 'Notes', icon: FileText, badge: notes.length },
                  ] as const).map(({ id, label, icon: Icon, badge }) => {
                    const active = activeChannel === id;
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => setActiveChannel(id)}
                        className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold transition-colors ${
                          active
                            ? 'border-primary/30 bg-primary/10 text-foreground'
                            : 'border-border bg-card/40 text-muted-foreground hover:text-foreground hover:bg-muted/40'
                        }`}
                      >
                        <Icon className={`h-4 w-4 ${active ? 'text-primary' : ''}`} />
                        {label}
                        {typeof badge === 'number' ? (
                          <span className="ml-1 text-[11px] rounded-full border border-border bg-background/60 px-2 py-0.5 text-muted-foreground">
                            {badge}
                          </span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              ) : null}
            </div>
          </div>

          <div className="flex-1 min-h-0">
            {isDiscover ? (
              <div className="h-full min-h-0 overflow-y-auto p-4">
                <div className="w-full">
                  <div className="mb-4 text-sm text-muted-foreground">
                    Join a group like you’d join a server.
                  </div>
                  {!user?.year ? (
                    <div className="mb-4 rounded-xl border border-border bg-background/60 p-4 text-sm text-muted-foreground">
                      <div className="font-semibold text-foreground">Complete your profile</div>
                      <div className="mt-1">
                        Public groups are filtered by your year. Add your year in Profile to see groups.
                      </div>
                      <button
                        type="button"
                        onClick={() => navigate('/profile')}
                        className="mt-3 inline-flex items-center gap-2 rounded-xl border border-border bg-card/40 px-3 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
                      >
                        <Users className="h-4 w-4" />
                        Go to Profile
                      </button>
                    </div>
                  ) : null}
                  {loading ? (
                    <div className="py-16 text-center text-sm text-muted-foreground">Loading…</div>
                  ) : filteredPublicGroups.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                      {filteredPublicGroups.map((group) => (
                        <GroupCard
                          key={group.id}
                          group={group}
                          onJoin={() => handleJoinGroup(group.id)}
                          isMember={false}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="py-16 text-center text-sm text-muted-foreground">No public groups found.</div>
                  )}
                  <div className="mt-6">
                    <AdUnit />
                  </div>
                </div>
              </div>
            ) : selectedGroup ? (
              <div className="h-full min-h-0">
                {activeChannel === 'chat' && user ? (
                  <ChatView
                    messages={messages}
                    newMessage={newMessage}
                    setNewMessage={setNewMessage}
                    onSend={handleSendMessage}
                    onSendAttachment={handleSendAttachment}
                    sending={sending}
                    currentUserId={user.uid}
                    groupId={selectedGroup.id}
                    canSend={Boolean(user)}
                  />
                ) : activeChannel === 'chat' ? (
                  <div className="h-full min-h-0 flex items-center justify-center p-8">
                    <div className="text-center max-w-md">
                      <MessageSquare className="mx-auto h-12 w-12 text-muted-foreground mb-3" />
                      <div className="text-lg font-semibold text-foreground">Sign in to chat</div>
                      <div className="mt-2 text-sm text-muted-foreground">
                        Preview mode lets you browse, but sending messages requires an account.
                      </div>
                    </div>
                  </div>
                ) : activeChannel === 'sessions' ? (
                  <SessionsView sessions={sessions} group={selectedGroup} user={user} />
                ) : (
                  <NotesView notes={notes} group={selectedGroup} user={user} />
                )}
              </div>
            ) : (
              <div className="h-full min-h-0 flex items-center justify-center p-8">
                <div className="w-full max-w-2xl">
                  <div className="rounded-2xl border border-border bg-card/30 p-6">
                    <div className="flex items-start gap-4">
                      <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                        <Users className="h-6 w-6 text-primary" />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="text-lg font-semibold text-foreground">
                          {hasServers ? 'Select a group' : 'Get started with study groups'}
                        </div>
                        <div className="mt-1 text-sm text-muted-foreground">
                          {hasServers
                            ? 'Pick a group from the sidebar to open chat, sessions, and notes.'
                            : 'Discover public groups, or create a new one for your class.'}
                        </div>

                        <div className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs text-muted-foreground">
                          <div className="rounded-xl border border-border bg-background/60 p-3">
                            <div className="flex items-center gap-2 text-foreground font-semibold">
                              <MessageSquare className="h-4 w-4 text-primary" />
                              Chat
                            </div>
                            <div className="mt-1">Real-time discussion with your group.</div>
                          </div>
                          <div className="rounded-xl border border-border bg-background/60 p-3">
                            <div className="flex items-center gap-2 text-foreground font-semibold">
                              <Video className="h-4 w-4 text-primary" />
                              Sessions
                            </div>
                            <div className="mt-1">Schedule study sessions and calls.</div>
                          </div>
                          <div className="rounded-xl border border-border bg-background/60 p-3">
                            <div className="flex items-center gap-2 text-foreground font-semibold">
                              <FileText className="h-4 w-4 text-primary" />
                              Notes
                            </div>
                            <div className="mt-1">Collaborate on shared notes.</div>
                          </div>
                        </div>

                        {showEmptySelection && !user ? (
                          <div className="mt-4 text-xs text-muted-foreground">
                            Preview mode lets you browse. Sign in to create/join and chat.
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Details / Members */}
        <aside className="hidden 2xl:block min-h-0 border-l border-border bg-card/20">
          <div className="h-full min-h-0 flex flex-col">
            <div className="p-4 border-b border-border">
              <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                {isDiscover ? 'Tips' : 'Details'}
              </div>
              <div className="mt-1 text-sm font-semibold text-foreground">
                {isDiscover ? 'How it works' : selectedGroup?.name || 'No group selected'}
              </div>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto p-4">
              {isDiscover ? (
                <div className="space-y-3 text-sm text-muted-foreground">
                  <div className="rounded-xl border border-border bg-background/60 p-4">
                    Browse public groups, then join to add it to your list.
                  </div>
                  <div className="rounded-xl border border-border bg-background/60 p-4">
                    Each group has channels: chat, sessions, notes.
                  </div>
                </div>
              ) : selectedGroup ? (
                <div className="space-y-3">
                  <div className="rounded-xl border border-border bg-background/60 p-4">
                    <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Subject</div>
                    <div className="mt-1 text-sm font-semibold text-foreground">{selectedGroup.subject}</div>
                  </div>
                  {selectedGroup.description ? (
                    <div className="rounded-xl border border-border bg-background/60 p-4">
                      <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Description</div>
                      <div className="mt-1 text-sm text-muted-foreground whitespace-pre-wrap">{selectedGroup.description}</div>
                    </div>
                  ) : null}
                  <div className="rounded-xl border border-border bg-background/60 p-4">
                    <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Members</div>
                    <div className="mt-1 flex items-center justify-between gap-2">
                      <div className="text-sm font-semibold text-foreground">
                        {memberCounts.online + memberCounts.idle}/{memberCounts.total} online
                      </div>
                      <div className="text-xs text-muted-foreground">{memberCounts.idle} idle</div>
                    </div>
                    <div className="mt-3 space-y-2">
                      {memberRows.map((m) => (
                        <div key={m.uid} className="flex items-center gap-3 rounded-lg border border-border bg-card/30 px-3 py-2">
                          <div
                            className={`h-2.5 w-2.5 rounded-full ${
                              m.status === 'online'
                                ? 'bg-primary'
                                : m.status === 'idle'
                                  ? 'bg-secondary'
                                  : 'bg-muted-foreground/40'
                            }`}
                          />
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-medium text-foreground">{m.name}</div>
                            <div className="text-[11px] capitalize text-muted-foreground">{m.status}</div>
                          </div>
                        </div>
                      ))}
                      {memberRows.length === 0 ? (
                        <div className="text-xs text-muted-foreground">No members found.</div>
                      ) : null}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="rounded-xl border border-border bg-background/60 p-4">
                    <div className="text-sm font-semibold text-foreground">
                      {hasServers ? 'No group selected' : 'Get started'}
                    </div>
                    <div className="mt-1 text-sm text-muted-foreground">
                      {hasServers
                        ? 'Select a group to see member status and details.'
                        : 'Discover public groups, join one, and it will appear in your list.'}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </aside>
      </div>

      {/* Create Group Modal */}
      {user && (
        <CreateGroupModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          user={user}
        />
      )}
    </div>
  );
};

const GroupCard: React.FC<{
  group: StudyGroup;
  onJoin?: () => void;
  isMember: boolean;
  compact?: boolean;
}> = ({ group, onJoin, isMember, compact = false }) => {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className={`bg-card border border-border rounded-xl hover:border-primary/50 transition-all ${
        isMember ? '' : ''
      } ${compact ? 'p-4' : 'p-6'}`}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <h3 className={`${compact ? 'text-base' : 'text-xl'} font-bold text-foreground mb-1`}>{group.name}</h3>
          <p className="text-sm text-muted-foreground">{group.subject}</p>
        </div>
        {!isMember && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onJoin && onJoin();
            }}
            className="flex items-center gap-1 px-3 py-1 bg-primary/20 text-primary rounded-lg hover:bg-primary/30 transition-all text-sm font-medium"
          >
            <UserPlus className="w-4 h-4" />
            Join
          </button>
        )}
      </div>

      {group.description && (
        <p className="text-muted-foreground text-sm mb-4 line-clamp-2">{group.description}</p>
      )}

      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Users className="w-4 h-4" />
          <span>{group.members.length} members</span>
        </div>
        {group.branch && (
          <span className="px-2 py-1 bg-secondary/20 text-secondary rounded text-xs font-medium">
            {group.branch}
          </span>
        )}
      </div>
    </motion.div>
  );
};

const EmptyState: React.FC<{ message: string; action: string }> = ({ message, action }) => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    className="col-span-full py-20 text-center"
  >
    <div className="w-20 h-20 bg-muted/30 rounded-full flex items-center justify-center mx-auto mb-4">
      <Users className="w-10 h-10 text-muted-foreground" />
    </div>
    <h3 className="text-xl font-bold text-foreground">{message}</h3>
    <p className="text-muted-foreground mt-2">{action}</p>
  </motion.div>
);

const CreateGroupModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  user: any;
}> = ({ isOpen, onClose, user }) => {
  const [formData, setFormData] = useState({
    name: '',
    subject: 'General',
    purpose: '',
    years: ['1', '2', '3', '4'] as string[],
  });
  const [creating, setCreating] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setCreating(true);
    try {
      await api.createStudyGroupRequest({
        name: formData.name.trim(),
        purpose: formData.purpose.trim(),
        subject: (formData.subject || 'General').trim() || 'General',
        visibleToYears: formData.years.length ? formData.years : ['1', '2', '3', '4'],
        requestedBy: user.uid,
        requestedByName: user.displayName || 'Unknown',
      });
      setSubmitted(true);
    } catch (error) {
      console.error('Error creating group:', error);
    } finally {
      setCreating(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-background/70 backdrop-brightness-50 flex items-center justify-center z-50 p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-card border border-border rounded-xl p-6 max-w-md w-full max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-foreground">Create Study Group</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        {submitted ? (
          <div className="space-y-4">
            <div className="rounded-xl border border-border bg-background/60 p-4 text-sm text-muted-foreground">
              Thank you for making one. Waiting for admin approval and your group will be created.
            </div>
            <button
              type="button"
              onClick={() => {
                setSubmitted(false);
                setFormData({ name: '', subject: 'General', purpose: '', years: ['1', '2', '3', '4'] });
                onClose();
              }}
              className="w-full px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-all"
            >
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-2">
              Group Name *
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-4 py-2 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:border-primary/50"
              placeholder="e.g., Data Structures Study Group"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-2">
              Subject (or write General) *
            </label>
            <input
              type="text"
              required
              value={formData.subject}
              onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
              className="w-full px-4 py-2 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:border-primary/50"
              placeholder="e.g., Computer Science / General"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-2">
              Purpose *
            </label>
            <textarea
              required
              value={formData.purpose}
              onChange={(e) => setFormData({ ...formData, purpose: e.target.value })}
              className="w-full px-4 py-2 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:border-primary/50"
              placeholder="What is this group for? (study plan, topics, exams, etc.)"
              rows={4}
            />
          </div>

          <div>
            <div className="block text-sm font-medium text-muted-foreground mb-2">Visible to which years? *</div>
            <div className="grid grid-cols-2 gap-2">
              {['1', '2', '3', '4'].map((y) => {
                const checked = formData.years.includes(y);
                return (
                  <label key={y} className="flex items-center gap-2 rounded-lg border border-border bg-background/60 px-3 py-2 text-sm text-foreground">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => {
                        const next = e.target.checked
                          ? Array.from(new Set([...formData.years, y]))
                          : formData.years.filter((v) => v !== y);
                        setFormData({ ...formData, years: next });
                      }}
                      className="h-4 w-4 rounded border-border"
                    />
                    Year {y}
                  </label>
                );
              })}
              <button
                type="button"
                onClick={() => setFormData({ ...formData, years: ['1', '2', '3', '4'] })}
                className="col-span-2 px-3 py-2 rounded-lg border border-border bg-muted/30 text-sm text-foreground hover:bg-muted/50 transition-all"
              >
                All years
              </button>
            </div>
            {formData.years.length === 0 ? (
              <div className="mt-2 text-xs text-destructive">Pick at least one year.</div>
            ) : null}
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-muted/40 text-foreground rounded-lg hover:bg-muted transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={creating || formData.years.length === 0}
              className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-all disabled:opacity-50"
            >
              {creating ? 'Submitting...' : 'Submit'}
            </button>
          </div>
        </form>
        )}
      </motion.div>
    </div>
  );
};

const ChatView: React.FC<{
  messages: Message[];
  newMessage: string;
  setNewMessage: (msg: string) => void;
  onSend: (e: React.FormEvent) => void;
  onSendAttachment: (params: { file: File; kind: 'file' | 'audio' }) => void;
  sending: boolean;
  currentUserId: string;
  groupId: string;
  canSend?: boolean;
}> = ({ messages, newMessage, setNewMessage, onSend, onSendAttachment, sending, currentUserId, groupId, canSend = true }) => {
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const listRef = React.useRef<HTMLDivElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [recording, setRecording] = useState(false);
  const recorderRef = React.useRef<MediaRecorder | null>(null);
  const chunksRef = React.useRef<BlobPart[]>([]);

  const toMs = (t: any): number => {
    if (typeof t === 'number') return t;
    if (typeof t?.toMillis === 'function') return t.toMillis();
    return 0;
  };

  const formatDay = (t: any): string => {
    const ms = toMs(t);
    if (!ms) return '';
    const d = new Date(ms);
    return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  };

  const isNearBottom = (el: HTMLDivElement): boolean => {
    const threshold = 120;
    return el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
  };

  // Autoscroll when new messages arrive, but don't fight the user if they've scrolled up.
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    if (!messages.length) return;
    if (!isNearBottom(el)) return;
    el.scrollTop = el.scrollHeight;
  }, [messages.length, groupId]);

  const stream = useMemo(() => {
    type Row =
      | { kind: 'day'; key: string; label: string }
      | { kind: 'msg'; key: string; msg: Message; showHeader: boolean; showAvatar: boolean };

    const rows: Row[] = [];
    const fiveMin = 5 * 60 * 1000;

    let lastDay = '';
    let prev: Message | undefined;

    for (const msg of messages) {
      const day = formatDay((msg as any).timestamp);
      if (day && day !== lastDay) {
        rows.push({ kind: 'day', key: `day:${day}`, label: day });
        lastDay = day;
        prev = undefined;
      }

      const sameSender = prev && prev.senderId === msg.senderId;
      const closeInTime =
        prev && Math.abs(toMs((msg as any).timestamp) - toMs((prev as any).timestamp)) <= fiveMin;
      const grouped = Boolean(sameSender && closeInTime);

      rows.push({
        kind: 'msg',
        key: msg.id || `${msg.senderId}:${toMs((msg as any).timestamp)}:${Math.random()}`,
        msg,
        showHeader: !grouped,
        showAvatar: !grouped,
      });

      prev = msg;
    }

    return rows;
  }, [messages]);

  const pickFile = () => {
    if (!canSend) return;
    fileInputRef.current?.click();
  };

  const onFilePicked: React.ChangeEventHandler<HTMLInputElement> = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    if (file.size > 20 * 1024 * 1024) return; // 20MB max (silent no-op)
    setUploading(true);
    try {
      await onSendAttachment({ file, kind: 'file' });
    } finally {
      setUploading(false);
    }
  };

  const startRecording = async () => {
    if (!canSend) return;
    if (recording) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (ev) => {
        if (ev.data && ev.data.size > 0) chunksRef.current.push(ev.data);
      };
      recorder.onstop = async () => {
        try {
          const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });
          const file = new File([blob], `voice-${Date.now()}.webm`, { type: blob.type });
          if (file.size > 20 * 1024 * 1024) return;
          setUploading(true);
          await onSendAttachment({ file, kind: 'audio' });
        } finally {
          setUploading(false);
          // stop tracks
          stream.getTracks().forEach((t) => t.stop());
        }
      };
      recorderRef.current = recorder;
      recorder.start();
      setRecording(true);
    } catch (err) {
      console.error('Mic permission/recording failed:', err);
    }
  };

  const stopRecording = () => {
    if (!recording) return;
    setRecording(false);
    try {
      recorderRef.current?.stop();
    } catch {
      // ignore
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div
        ref={listRef}
        className="flex-1 overflow-y-auto px-4 py-4"
        role="log"
        aria-live="polite"
        aria-relevant="additions"
      >
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            <div className="text-center">
              <MessageSquare className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>No messages yet. Start the conversation!</p>
            </div>
          </div>
        ) : (
          <div className="space-y-1">
            {stream.map((row) => {
              if (row.kind === 'day') {
                return (
                  <div key={row.key} className="py-4">
                    <div className="flex items-center gap-3">
                      <div className="h-px flex-1 bg-border" aria-hidden="true" />
                      <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                        {row.label}
                      </div>
                      <div className="h-px flex-1 bg-border" aria-hidden="true" />
                    </div>
                  </div>
                );
              }

              const message = row.msg;
              const isMine = message.senderId === currentUserId;

              return (
                <div
                  key={row.key}
                  className={`group flex gap-3 px-2 py-1.5 rounded-lg hover:bg-muted/20 ${isMine ? 'justify-end' : 'justify-start'}`}
                >
                  {/* Avatar */}
                  {!isMine ? (
                    <div className="w-9 shrink-0">
                      {row.showAvatar ? (
                        message.senderPhotoURL ? (
                          <img
                            src={message.senderPhotoURL}
                            alt={message.senderName}
                            className="w-9 h-9 rounded-full"
                          />
                        ) : (
                          <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center text-primary text-sm font-bold">
                            {message.senderName.charAt(0).toUpperCase()}
                          </div>
                        )
                      ) : (
                        <div className="w-9 h-9" aria-hidden="true" />
                      )}
                    </div>
                  ) : null}

                  <div className={`min-w-0 max-w-[min(720px,100%)] ${isMine ? 'text-right' : ''}`}>
                    {row.showHeader ? (
                      <div className={`flex items-baseline gap-2 ${isMine ? 'justify-end' : 'justify-start'}`}>
                        <div className="text-sm font-semibold text-foreground truncate">{message.senderName}</div>
                        <div className="text-[11px] text-muted-foreground">
                          {formatTimestamp(message.timestamp, 'time')}
                        </div>
                      </div>
                    ) : null}

                    <div className={`mt-0.5 inline-block rounded-2xl px-4 py-2 border ${
                      isMine
                        ? 'bg-primary text-primary-foreground border-primary/20'
                        : 'bg-card text-foreground border-border'
                    }`}>
                      {message.kind === 'audio' && message.fileUrl ? (
                        <div className="space-y-2">
                          <div className="text-sm">{message.content || 'Voice message'}</div>
                          {safeExternalHttpUrl(message.fileUrl) ? (
                            <audio controls src={safeExternalHttpUrl(message.fileUrl) as string} className="w-[260px] max-w-full" />
                          ) : (
                            <div className="text-xs opacity-80">Attachment unavailable</div>
                          )}
                        </div>
                      ) : message.kind === 'file' && message.fileUrl ? (
                        safeExternalHttpUrl(message.fileUrl) ? (
                          <a
                            href={safeExternalHttpUrl(message.fileUrl) as string}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="underline underline-offset-2"
                          >
                            {message.fileName || message.content || 'Download file'}
                          </a>
                        ) : (
                          <span className="text-xs opacity-80">Attachment unavailable</span>
                        )
                      ) : (
                        <span className="text-sm whitespace-pre-wrap break-words">{message.content}</span>
                      )}
                    </div>
                  </div>

                  {/* Spacer for right-aligned messages to keep layout stable */}
                  {isMine ? <div className="w-9 shrink-0" aria-hidden="true" /> : null}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Input */}
      <form onSubmit={onSend} className="p-4 border-t border-border">
        <div className="flex gap-2">
          <input ref={fileInputRef} type="file" className="hidden" onChange={onFilePicked} />
          <button
            type="button"
            onClick={pickFile}
            disabled={!canSend || uploading || recording}
            className="px-3 py-2 bg-muted/40 text-foreground rounded-lg hover:bg-muted transition-all disabled:opacity-50"
            title="Upload file"
            aria-label="Upload file"
          >
            <Paperclip className="w-5 h-5" />
          </button>

          <button
            type="button"
            onClick={recording ? stopRecording : startRecording}
            disabled={!canSend || uploading}
            className="px-3 py-2 bg-muted/40 text-foreground rounded-lg hover:bg-muted transition-all disabled:opacity-50"
            title={recording ? 'Stop recording' : 'Record voice message'}
            aria-label={recording ? 'Stop recording' : 'Record voice message'}
          >
            {recording ? <Square className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          </button>

          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type a message..."
            disabled={!canSend}
            className="flex-1 px-4 py-2 bg-background border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={!canSend || sending || !newMessage.trim()}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-all disabled:opacity-50"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
        {!canSend ? (
          <div className="mt-2 text-xs text-muted-foreground">Sign in to send messages.</div>
        ) : uploading ? (
          <div className="mt-2 text-xs text-muted-foreground">Uploading…</div>
        ) : recording ? (
          <div className="mt-2 text-xs text-muted-foreground">Recording… press stop to send.</div>
        ) : null}
      </form>
    </div>
  );
};

const SessionsView: React.FC<{
  sessions: Session[];
  group: StudyGroup;
  user: any;
}> = ({ sessions, group, user }) => {
  const isAdmin = group.admins.includes(user.uid);

  return (
    <div className="h-full overflow-y-auto p-6">
      {sessions.length === 0 ? (
        <div className="flex items-center justify-center h-full text-muted-foreground">
          <div className="text-center">
            <Video className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>No sessions scheduled yet.</p>
            {isAdmin && <p className="text-sm mt-2">Create a session to get started!</p>}
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {sessions.map((session) => (
            <div key={session.id} className="bg-background border border-border rounded-lg p-4">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h4 className="font-bold text-foreground">{session.title}</h4>
                  {session.description && (
                    <p className="text-sm text-muted-foreground mt-1">{session.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {session.videoUrl && safeExternalHttpUrl(session.videoUrl) ? (
                    <a
                      href={safeExternalHttpUrl(session.videoUrl) as string}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-xs font-semibold text-primary hover:underline"
                    >
                      Join session
                    </a>
                  ) : null}
                  <span className="text-xs font-semibold text-muted-foreground">{session.status}</span>
                </div>
              </div>
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Calendar className="w-4 h-4" />
                  {formatTimestamp(session.scheduledAt, 'date') || 'TBD'}
                </div>
                <div>Duration: {session.duration}min</div>
              </div>
              {session.videoUrl && safeExternalHttpUrl(session.videoUrl) ? (
                <a
                  href={safeExternalHttpUrl(session.videoUrl) as string}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-all text-sm"
                >
                  <Video className="w-4 h-4" />
                  Join Video Call
                </a>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const NotesView: React.FC<{
  notes: CollaborativeNote[];
  group: StudyGroup;
  user: any;
}> = ({ notes, group, user }) => {
  return (
    <div className="h-full overflow-y-auto p-6">
      {notes.length === 0 ? (
        <div className="flex items-center justify-center h-full text-muted-foreground">
          <div className="text-center">
            <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>No collaborative notes yet.</p>
            <p className="text-sm mt-2">Create a note to start collaborating!</p>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {notes.map((note) => (
            <div key={note.id} className="bg-background border border-border rounded-lg p-4">
              <h4 className="font-bold text-foreground mb-2">{note.title}</h4>
              <p className="text-muted-foreground text-sm mb-3 line-clamp-3">{note.content}</p>
              <div className="text-xs text-muted-foreground">
                Last edited by {note.lastEditedByName} •{' '}
                {formatTimestamp(note.lastEditedAt)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default StudyGroupsPage;
