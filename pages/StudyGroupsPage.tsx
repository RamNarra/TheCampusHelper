import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/firebase';
import { StudyGroup, Message, Session, CollaborativeNote } from '../types';
import AdUnit from '../components/AdUnit';
import { isAuthBypassed } from '../lib/dev';

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
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);

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

    // Subscribe to public groups
    const unsubscribePublic = api.onStudyGroupsChanged((groups) => {
      setPublicGroups(groups.filter(g => !g.members.includes(user.uid)));
    });

    return () => {
      unsubscribeMyGroups();
      unsubscribePublic();
    };
  }, [user]);

  const selectedGroup = useMemo(() => {
    if (!selectedGroupId) return null;
    return myGroups.find((g) => g.id === selectedGroupId) ?? null;
  }, [myGroups, selectedGroupId]);

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
      });
      setNewMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setSending(false);
    }
  }, [newMessage, selectedGroupId, user]);

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

  const ServerButton: React.FC<{
    label: string;
    active?: boolean;
    onClick: () => void;
    children: React.ReactNode;
  }> = ({ label, active, onClick, children }) => (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`group relative grid h-12 w-12 place-items-center overflow-hidden rounded-2xl border transition-all ${
        active
          ? 'border-primary/50 bg-primary/15'
          : 'border-border bg-card/40 hover:bg-muted/40 hover:border-primary/30'
      }`}
    >
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-secondary/10 opacity-0 transition-opacity group-hover:opacity-100" />
      <div className="relative z-10">{children}</div>
    </button>
  );

  const selectGroup = (groupId: string) => {
    setIsDiscover(false);
    setSelectedGroupId(groupId);
    setActiveChannel('chat');
  };

  const openDiscover = () => {
    setIsDiscover(true);
    setSelectedGroupId(null);
  };

  return (
    <div className="flex-1 min-h-0">
      <div className="h-full min-h-0 grid grid-cols-[72px_1fr] lg:grid-cols-[72px_260px_1fr] xl:grid-cols-[72px_260px_1fr_280px]">
        {/* Servers */}
        <aside className="min-h-0 border-r border-border bg-background/60 backdrop-blur">
          <div className="h-full min-h-0 flex flex-col">
            <div className="p-3 flex flex-col gap-3">
              <ServerButton
                label="Discover servers"
                active={isDiscover}
                onClick={openDiscover}
              >
                <Compass className={`h-5 w-5 ${isDiscover ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground'}`} />
              </ServerButton>

              <div className="h-px bg-border" />

              <div className="flex flex-col gap-3">
                {myGroups.map((g) => {
                  const isActive = !isDiscover && selectedGroupId === g.id;
                  const letter = (g.name || 'G').trim().charAt(0).toUpperCase();
                  return (
                    <ServerButton
                      key={g.id}
                      label={g.name}
                      active={isActive}
                      onClick={() => selectGroup(g.id)}
                    >
                      <div
                        className={`grid h-9 w-9 place-items-center rounded-xl text-sm font-bold ${
                          isActive
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted/40 text-foreground'
                        }`}
                      >
                        {letter}
                      </div>
                    </ServerButton>
                  );
                })}

                {myGroups.length === 0 && !loading ? (
                  <div className="px-2 text-center text-xs text-muted-foreground">
                    No servers
                  </div>
                ) : null}
              </div>
            </div>

            <div className="mt-auto p-3 flex flex-col gap-3">
              <ServerButton
                label="Create a server"
                active={false}
                onClick={handleCreateGroup}
              >
                <Plus className="h-5 w-5 text-muted-foreground group-hover:text-foreground" />
              </ServerButton>
            </div>
          </div>
        </aside>

        {/* Channels */}
        <aside className="hidden lg:block min-h-0 border-r border-border bg-card/30">
          <div className="h-full min-h-0 flex flex-col">
            <div className="p-4 border-b border-border">
              <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                {isDiscover ? 'Explore' : 'Server'}
              </div>
              <div className="mt-1 text-base font-bold text-foreground truncate">
                {isDiscover ? 'Discover groups' : selectedGroup?.name || 'Select a group'}
              </div>
              {selectedGroup?.subject ? (
                <div className="mt-1 text-xs text-muted-foreground truncate">{selectedGroup.subject}</div>
              ) : null}
            </div>

            <div className="p-4">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="h-4 w-4 text-muted-foreground" />
                </div>
                <input
                  type="text"
                  placeholder={isDiscover ? 'Search public groups…' : 'Search servers…'}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="block w-full pl-10 pr-3 py-2 border border-border rounded-xl bg-background/60 text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-all"
                />
              </div>
            </div>

            {isDiscover ? (
              <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-4">
                <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                  Public groups
                </div>
                {loading ? (
                  <div className="py-12 text-center text-sm text-muted-foreground">Loading…</div>
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
                  <div className="py-12 text-center text-sm text-muted-foreground">
                    No public groups found.
                  </div>
                )}
              </div>
            ) : (
              <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-4">
                <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                  Channels
                </div>
                {selectedGroup ? (
                  <div className="space-y-1">
                    {channels.map(({ id, name, icon: Icon, badge }) => {
                      const active = activeChannel === id;
                      return (
                        <button
                          key={id}
                          type="button"
                          onClick={() => setActiveChannel(id)}
                          className={`w-full flex items-center justify-between gap-3 rounded-xl px-3 py-2 text-sm transition-colors ${
                            active
                              ? 'bg-primary/12 text-foreground border border-primary/20'
                              : 'text-muted-foreground hover:text-foreground hover:bg-muted/40 border border-transparent'
                          }`}
                        >
                          <span className="flex items-center gap-2 min-w-0">
                            <Icon className={`h-4 w-4 ${active ? 'text-primary' : ''}`} />
                            <span className="truncate"># {name}</span>
                          </span>
                          {typeof badge === 'number' ? (
                            <span className="text-xs rounded-full border border-border bg-background/60 px-2 py-0.5 text-muted-foreground">
                              {badge}
                            </span>
                          ) : null}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="py-12 text-center text-sm text-muted-foreground">
                    Select a group to see channels.
                  </div>
                )}
              </div>
            )}
          </div>
        </aside>

        {/* Main */}
        <section className="min-h-0 flex flex-col">
          <div className="border-b border-border bg-background/60 backdrop-blur">
            <div className="px-4 py-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-semibold text-foreground truncate">
                  {isDiscover
                    ? 'Explore public groups'
                    : selectedGroup
                      ? `${selectedGroup.name} · # ${channels.find((c) => c.id === activeChannel)?.name || 'general'}`
                      : 'Select a group'}
                </div>
                <div className="text-xs text-muted-foreground truncate">
                  {isPreview
                    ? 'Preview mode enabled. Sign in to create/join and chat.'
                    : selectedGroup?.subject || 'Real-time chat, sessions, and notes.'}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={openDiscover}
                  className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold transition-colors ${
                    isDiscover
                      ? 'border-primary/30 bg-primary/10 text-foreground'
                      : 'border-border bg-card/40 text-muted-foreground hover:text-foreground hover:bg-muted/40'
                  }`}
                >
                  <Compass className="h-4 w-4" />
                  Discover
                </button>
                <button
                  type="button"
                  onClick={handleCreateGroup}
                  disabled={!user}
                  className="inline-flex items-center gap-2 rounded-xl bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
                >
                  <Plus className="h-4 w-4" />
                  Create
                </button>
              </div>
            </div>
          </div>

          <div className="flex-1 min-h-0">
            {isDiscover ? (
              <div className="h-full min-h-0 overflow-y-auto p-4">
                <div className="max-w-3xl">
                  <div className="mb-4 text-sm text-muted-foreground">
                    Join a group like you’d join a server.
                  </div>
                  {loading ? (
                    <div className="py-16 text-center text-sm text-muted-foreground">Loading…</div>
                  ) : filteredPublicGroups.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                    sending={sending}
                    currentUserId={user.uid}
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
                <div className="text-center max-w-md">
                  <Users className="mx-auto h-12 w-12 text-muted-foreground mb-3" />
                  <div className="text-lg font-semibold text-foreground">Select a group</div>
                  <div className="mt-2 text-sm text-muted-foreground">Pick a server on the left, or discover a new one.</div>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Details / Members */}
        <aside className="hidden xl:block min-h-0 border-l border-border bg-card/20">
          <div className="h-full min-h-0 flex flex-col">
            <div className="p-4 border-b border-border">
              <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                {isDiscover ? 'Tips' : 'About'}
              </div>
              <div className="mt-1 text-sm font-semibold text-foreground">
                {isDiscover ? 'How it works' : selectedGroup?.name || 'No server selected'}
              </div>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto p-4">
              {isDiscover ? (
                <div className="space-y-3 text-sm text-muted-foreground">
                  <div className="rounded-xl border border-border bg-background/60 p-4">
                    Browse public groups, then join to show it in your server list.
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
                    <div className="mt-1 text-sm font-semibold text-foreground">{selectedGroup.members.length}</div>
                    <div className="mt-2 text-xs text-muted-foreground">Member list display will improve once profiles are wired in.</div>
                  </div>
                </div>
              ) : (
                <div className="py-10 text-center text-sm text-muted-foreground">Select a server to see details.</div>
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
    subject: '',
    description: '',
    branch: '',
    semester: '',
    isPrivate: false,
    maxMembers: 50
  });
  const [creating, setCreating] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setCreating(true);
    try {
      await api.createStudyGroup({
        name: formData.name,
        subject: formData.subject,
        description: formData.description || undefined,
        branch: formData.branch as any || undefined,
        semester: formData.semester || undefined,
        members: [user.uid],
        admins: [user.uid],
        createdBy: user.uid,
        createdByName: user.displayName || 'Unknown',
        isPrivate: formData.isPrivate,
        maxMembers: formData.maxMembers
      });
      onClose();
      setFormData({
        name: '',
        subject: '',
        description: '',
        branch: '',
        semester: '',
        isPrivate: false,
        maxMembers: 50
      });
    } catch (error) {
      console.error('Error creating group:', error);
    } finally {
      setCreating(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
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
              Subject *
            </label>
            <input
              type="text"
              required
              value={formData.subject}
              onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
              className="w-full px-4 py-2 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:border-primary/50"
              placeholder="e.g., Computer Science"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-2">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-4 py-2 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:border-primary/50"
              placeholder="Brief description of the group"
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-2">
                Branch
              </label>
              <select
                value={formData.branch}
                onChange={(e) => setFormData({ ...formData, branch: e.target.value })}
                className="w-full px-4 py-2 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:border-primary/50"
              >
                <option value="">Select...</option>
                <option value="CS_IT_DS">CS/IT/DS</option>
                <option value="AIML_ECE_CYS">AIML/ECE/CYS</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-2">
                Semester
              </label>
              <select
                value={formData.semester}
                onChange={(e) => setFormData({ ...formData, semester: e.target.value })}
                className="w-full px-4 py-2 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:border-primary/50"
              >
                <option value="">Select...</option>
                {[1, 2, 3, 4, 5, 6, 7, 8].map(sem => (
                  <option key={sem} value={sem.toString()}>{sem}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="isPrivate"
              checked={formData.isPrivate}
              onChange={(e) => setFormData({ ...formData, isPrivate: e.target.checked })}
              className="w-4 h-4 rounded border-border"
            />
            <label htmlFor="isPrivate" className="text-sm text-muted-foreground">
              Make this group private (require approval to join)
            </label>
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
              disabled={creating}
              className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-all disabled:opacity-50"
            >
              {creating ? 'Creating...' : 'Create Group'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};

const ChatView: React.FC<{
  messages: Message[];
  newMessage: string;
  setNewMessage: (msg: string) => void;
  onSend: (e: React.FormEvent) => void;
  sending: boolean;
  currentUserId: string;
  canSend?: boolean;
}> = ({ messages, newMessage, setNewMessage, onSend, sending, currentUserId, canSend = true }) => {
  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            <div className="text-center">
              <MessageSquare className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>No messages yet. Start the conversation!</p>
            </div>
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={`flex gap-3 ${message.senderId === currentUserId ? 'flex-row-reverse' : ''}`}
            >
              {message.senderPhotoURL ? (
                <img
                  src={message.senderPhotoURL}
                  alt={message.senderName}
                  className="w-8 h-8 rounded-full"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary text-sm font-bold">
                  {message.senderName.charAt(0).toUpperCase()}
                </div>
              )}
              <div className={`flex-1 ${message.senderId === currentUserId ? 'text-right' : ''}`}>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-medium text-foreground">{message.senderName}</span>
                  <span className="text-xs text-muted-foreground">
                    {formatTimestamp(message.timestamp, 'time')}
                  </span>
                </div>
                <div
                  className={`inline-block px-4 py-2 rounded-lg ${
                    message.senderId === currentUserId
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted/40 text-foreground'
                  }`}
                >
                  {message.content}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Input */}
      <form onSubmit={onSend} className="p-4 border-t border-border">
        <div className="flex gap-2">
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
                <span
                  className={`px-2 py-1 rounded text-xs font-medium ${
                    session.status === 'active'
                      ? 'bg-primary/10 text-primary'
                      : session.status === 'scheduled'
                      ? 'bg-secondary/10 text-secondary'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {session.status}
                </span>
              </div>
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Calendar className="w-4 h-4" />
                  {formatTimestamp(session.scheduledAt, 'date') || 'TBD'}
                </div>
                <div>Duration: {session.duration}min</div>
              </div>
              {session.videoUrl && (
                <a
                  href={session.videoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-all text-sm"
                >
                  <Video className="w-4 h-4" />
                  Join Video Call
                </a>
              )}
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
