import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, Plus, Search, X, MessageSquare, Video, FileText, Calendar, UserPlus, Settings, Trash2, Send, Edit2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/firebase';
import { StudyGroup, Message, Session, CollaborativeNote } from '../types';
import AdUnit from '../components/AdUnit';

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
  const [myGroups, setMyGroups] = useState<StudyGroup[]>([]);
  const [publicGroups, setPublicGroups] = useState<StudyGroup[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<StudyGroup | null>(null);
  const [activeTab, setActiveTab] = useState<'myGroups' | 'discover'>('myGroups');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

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

  const handleCreateGroup = () => {
    setShowCreateModal(true);
  };

  const handleJoinGroup = async (groupId: string) => {
    if (!user) return;
    try {
      await api.joinStudyGroup(groupId, user.uid);
    } catch (error) {
      console.error('Error joining group:', error);
    }
  };

  const filteredMyGroups = myGroups.filter(group =>
    group.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    group.subject.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredPublicGroups = publicGroups.filter(group =>
    group.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    group.subject.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (!user) {
    return (
      <div className="min-h-screen pt-24 pb-12 px-4 flex items-center justify-center">
        <div className="text-center">
          <Users className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-white mb-2">Please Sign In</h2>
          <p className="text-gray-400">You need to be logged in to access study groups.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-24 pb-12 px-4 max-w-7xl mx-auto sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-10">
        <h1 className="text-3xl sm:text-4xl font-bold text-white mb-3 flex items-center gap-3">
          <Users className="w-8 h-8 sm:w-10 sm:h-10 text-secondary" />
          Study Groups
        </h1>
        <p className="text-gray-400 text-lg">
          Collaborate with peers in real-time through study groups, chat, and video sessions.
        </p>
      </div>

      <AdUnit className="mb-8" />

      {/* Tabs and Actions */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-8">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('myGroups')}
            className={`px-6 py-2 rounded-full text-sm font-medium transition-all ${
              activeTab === 'myGroups'
                ? 'bg-white text-black font-bold shadow-lg'
                : 'bg-white/5 text-gray-400 hover:text-white hover:bg-white/10 border border-white/5'
            }`}
          >
            My Groups ({myGroups.length})
          </button>
          <button
            onClick={() => setActiveTab('discover')}
            className={`px-6 py-2 rounded-full text-sm font-medium transition-all ${
              activeTab === 'discover'
                ? 'bg-white text-black font-bold shadow-lg'
                : 'bg-white/5 text-gray-400 hover:text-white hover:bg-white/10 border border-white/5'
            }`}
          >
            Discover
          </button>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-gray-500" />
            </div>
            <input
              type="text"
              placeholder="Search groups..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="block w-full pl-10 pr-3 py-2 border border-white/10 rounded-xl bg-card/50 text-gray-300 placeholder-gray-500 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-all"
            />
          </div>
          <button
            onClick={handleCreateGroup}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl hover:bg-primary/90 font-medium transition-all shadow-lg shadow-primary/30"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Create Group</span>
          </button>
        </div>
      </div>

      {/* Groups Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <AnimatePresence mode="popLayout">
            {activeTab === 'myGroups' ? (
              filteredMyGroups.length > 0 ? (
                filteredMyGroups.map((group) => (
                  <GroupCard
                    key={group.id}
                    group={group}
                    onSelect={setSelectedGroup}
                    isMember={true}
                  />
                ))
              ) : (
                <EmptyState
                  message="You haven't joined any groups yet"
                  action="Create or join a group to start collaborating!"
                />
              )
            ) : (
              filteredPublicGroups.length > 0 ? (
                filteredPublicGroups.map((group) => (
                  <GroupCard
                    key={group.id}
                    group={group}
                    onJoin={() => handleJoinGroup(group.id)}
                    isMember={false}
                  />
                ))
              ) : (
                <EmptyState
                  message="No public groups available"
                  action="Be the first to create a public study group!"
                />
              )
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Create Group Modal */}
      <CreateGroupModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        user={user}
      />

      {/* Group Details Modal */}
      {selectedGroup && (
        <GroupDetailsModal
          group={selectedGroup}
          onClose={() => setSelectedGroup(null)}
          user={user}
        />
      )}
    </div>
  );
};

const GroupCard: React.FC<{
  group: StudyGroup;
  onSelect?: (group: StudyGroup) => void;
  onJoin?: () => void;
  isMember: boolean;
}> = ({ group, onSelect, onJoin, isMember }) => {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className="bg-card border border-white/10 rounded-xl p-6 hover:border-primary/50 transition-all cursor-pointer"
      onClick={() => isMember && onSelect && onSelect(group)}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <h3 className="text-xl font-bold text-white mb-1">{group.name}</h3>
          <p className="text-sm text-gray-400">{group.subject}</p>
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
        <p className="text-gray-400 text-sm mb-4 line-clamp-2">{group.description}</p>
      )}

      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-2 text-gray-500">
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
    <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4">
      <Users className="w-10 h-10 text-gray-600" />
    </div>
    <h3 className="text-xl font-bold text-gray-300">{message}</h3>
    <p className="text-gray-500 mt-2">{action}</p>
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
        className="bg-card border border-white/10 rounded-xl p-6 max-w-md w-full max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-white">Create Study Group</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Group Name *
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-4 py-2 bg-background border border-white/10 rounded-lg text-white focus:outline-none focus:border-primary/50"
              placeholder="e.g., Data Structures Study Group"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Subject *
            </label>
            <input
              type="text"
              required
              value={formData.subject}
              onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
              className="w-full px-4 py-2 bg-background border border-white/10 rounded-lg text-white focus:outline-none focus:border-primary/50"
              placeholder="e.g., Computer Science"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-4 py-2 bg-background border border-white/10 rounded-lg text-white focus:outline-none focus:border-primary/50"
              placeholder="Brief description of the group"
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Branch
              </label>
              <select
                value={formData.branch}
                onChange={(e) => setFormData({ ...formData, branch: e.target.value })}
                className="w-full px-4 py-2 bg-background border border-white/10 rounded-lg text-white focus:outline-none focus:border-primary/50"
              >
                <option value="">Select...</option>
                <option value="CS_IT_DS">CS/IT/DS</option>
                <option value="AIML_ECE_CYS">AIML/ECE/CYS</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Semester
              </label>
              <select
                value={formData.semester}
                onChange={(e) => setFormData({ ...formData, semester: e.target.value })}
                className="w-full px-4 py-2 bg-background border border-white/10 rounded-lg text-white focus:outline-none focus:border-primary/50"
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
              className="w-4 h-4 rounded border-white/10"
            />
            <label htmlFor="isPrivate" className="text-sm text-gray-300">
              Make this group private (require approval to join)
            </label>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-white/5 text-white rounded-lg hover:bg-white/10 transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={creating}
              className="flex-1 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-all disabled:opacity-50"
            >
              {creating ? 'Creating...' : 'Create Group'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};

const GroupDetailsModal: React.FC<{
  group: StudyGroup;
  onClose: () => void;
  user: any;
}> = ({ group, onClose, user }) => {
  const [activeTab, setActiveTab] = useState<'chat' | 'sessions' | 'notes'>('chat');
  const [messages, setMessages] = useState<Message[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [notes, setNotes] = useState<CollaborativeNote[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    const unsubMessages = api.onMessagesChanged(group.id, setMessages);
    const unsubSessions = api.onSessionsChanged(group.id, setSessions);
    const unsubNotes = api.onNotesChanged(group.id, setNotes);

    return () => {
      unsubMessages();
      unsubSessions();
      unsubNotes();
    };
  }, [group.id]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !user) return;

    setSending(true);
    try {
      await api.sendMessage(group.id, {
        studyGroupId: group.id,
        senderId: user.uid,
        senderName: user.displayName || 'Unknown',
        senderPhotoURL: user.photoURL || undefined,
        content: newMessage.trim()
      });
      setNewMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-card border border-white/10 rounded-xl w-full max-w-4xl h-[80vh] flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/10">
          <div>
            <h2 className="text-2xl font-bold text-white">{group.name}</h2>
            <p className="text-sm text-gray-400">{group.subject}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-2 p-4 border-b border-white/10">
          <button
            onClick={() => setActiveTab('chat')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
              activeTab === 'chat'
                ? 'bg-primary text-white'
                : 'bg-white/5 text-gray-400 hover:text-white'
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            Chat
          </button>
          <button
            onClick={() => setActiveTab('sessions')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
              activeTab === 'sessions'
                ? 'bg-primary text-white'
                : 'bg-white/5 text-gray-400 hover:text-white'
            }`}
          >
            <Video className="w-4 h-4" />
            Sessions ({sessions.length})
          </button>
          <button
            onClick={() => setActiveTab('notes')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
              activeTab === 'notes'
                ? 'bg-primary text-white'
                : 'bg-white/5 text-gray-400 hover:text-white'
            }`}
          >
            <FileText className="w-4 h-4" />
            Notes ({notes.length})
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          {activeTab === 'chat' && (
            <ChatView
              messages={messages}
              newMessage={newMessage}
              setNewMessage={setNewMessage}
              onSend={handleSendMessage}
              sending={sending}
              currentUserId={user.uid}
            />
          )}
          {activeTab === 'sessions' && (
            <SessionsView sessions={sessions} group={group} user={user} />
          )}
          {activeTab === 'notes' && (
            <NotesView notes={notes} group={group} user={user} />
          )}
        </div>
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
}> = ({ messages, newMessage, setNewMessage, onSend, sending, currentUserId }) => {
  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-500">
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
                  <span className="text-sm font-medium text-gray-300">{message.senderName}</span>
                  <span className="text-xs text-gray-500">
                    {formatTimestamp(message.timestamp, 'time')}
                  </span>
                </div>
                <div
                  className={`inline-block px-4 py-2 rounded-lg ${
                    message.senderId === currentUserId
                      ? 'bg-primary text-white'
                      : 'bg-white/5 text-gray-300'
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
      <form onSubmit={onSend} className="p-4 border-t border-white/10">
        <div className="flex gap-2">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 px-4 py-2 bg-background border border-white/10 rounded-lg text-white focus:outline-none focus:border-primary/50"
          />
          <button
            type="submit"
            disabled={sending || !newMessage.trim()}
            className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-all disabled:opacity-50"
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
        <div className="flex items-center justify-center h-full text-gray-500">
          <div className="text-center">
            <Video className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>No sessions scheduled yet.</p>
            {isAdmin && <p className="text-sm mt-2">Create a session to get started!</p>}
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {sessions.map((session) => (
            <div key={session.id} className="bg-background border border-white/10 rounded-lg p-4">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h4 className="font-bold text-white">{session.title}</h4>
                  {session.description && (
                    <p className="text-sm text-gray-400 mt-1">{session.description}</p>
                  )}
                </div>
                <span
                  className={`px-2 py-1 rounded text-xs font-medium ${
                    session.status === 'active'
                      ? 'bg-green-500/20 text-green-400'
                      : session.status === 'scheduled'
                      ? 'bg-blue-500/20 text-blue-400'
                      : 'bg-gray-500/20 text-gray-400'
                  }`}
                >
                  {session.status}
                </span>
              </div>
              <div className="flex items-center gap-4 text-sm text-gray-400">
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
                  className="mt-3 inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-all text-sm"
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
        <div className="flex items-center justify-center h-full text-gray-500">
          <div className="text-center">
            <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>No collaborative notes yet.</p>
            <p className="text-sm mt-2">Create a note to start collaborating!</p>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {notes.map((note) => (
            <div key={note.id} className="bg-background border border-white/10 rounded-lg p-4">
              <h4 className="font-bold text-white mb-2">{note.title}</h4>
              <p className="text-gray-400 text-sm mb-3 line-clamp-3">{note.content}</p>
              <div className="text-xs text-gray-500">
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
