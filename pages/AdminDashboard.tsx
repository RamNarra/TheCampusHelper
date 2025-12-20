
import React, { useMemo, useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/firebase';
import { UserProfile } from '../types';
import { Resource, UserRole } from '../types';
import { motion } from 'framer-motion';
import { Check, X, Eye, FileText, Users, Download, Search, Shield, Calendar, Trash2, ExternalLink, Mail } from 'lucide-react';
import { Navigate } from 'react-router-dom';
import { isAtLeastRole, normalizeRole } from '../lib/rbac';

const AdminDashboard: React.FC = () => {
  const { user } = useAuth();
  const role = normalizeRole(user?.role);
  const [activeTab, setActiveTab] = useState<'overview' | 'approvals' | 'resources' | 'users'>('overview');
  const [usersList, setUsersList] = useState<UserProfile[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [userSearchTerm, setUserSearchTerm] = useState('');
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [pendingResources, setPendingResources] = useState<Resource[]>([]);
  const [isLoadingApprovals, setIsLoadingApprovals] = useState(true);
  const [allResources, setAllResources] = useState<Resource[]>([]);
  const [isLoadingResources, setIsLoadingResources] = useState(false);
  const [resourceSearchTerm, setResourceSearchTerm] = useState('');

  // Fetch users for admin-only User Database (and stats)
  useEffect(() => {
    if (isAtLeastRole(role, 'admin') && (activeTab === 'users' || activeTab === 'overview')) {
      const fetchUsers = async () => {
        setIsLoadingUsers(true);
        const data = await api.getAllUsers();
        setUsersList(data);
        setIsLoadingUsers(false);
      };
      fetchUsers();
    }
  }, [activeTab, role]);

  // Staff: subscribe to all resources (used for stats + management)
  useEffect(() => {
    if (!user || !isAtLeastRole(role, 'moderator')) return;
    setIsLoadingResources(true);
    const unsub = api.onAllResourcesChanged((list) => {
      setAllResources(list);
      setIsLoadingResources(false);
    });
    return () => unsub();
  }, [role, user]);

  // Mods/admins: subscribe to pending resource approvals
  useEffect(() => {
    if (!user || !isAtLeastRole(role, 'moderator')) return;
    setIsLoadingApprovals(true);
    const unsub = api.onPendingResourcesChanged((list) => {
      setPendingResources(list);
      setIsLoadingApprovals(false);
    });
    return () => unsub();
  }, [role, user]);

  if (!user || !isAtLeastRole(role, 'moderator')) {
    return <Navigate to="/" replace />;
  }

  const handleApprove = async (id: string) => {
    try {
      await api.updateResourceStatus(id, 'approved');
    } catch (e) {
      console.error('Approve failed:', e);
    }
  };

  const handleReject = async (id: string, reason?: string | null) => {
    try {
      await api.updateResourceStatus(id, 'rejected', { rejectionReason: reason ?? '' });
    } catch (e) {
      console.error('Reject failed:', e);
    }
  };

  const handleResetToPending = async (id: string) => {
    if (!isAtLeastRole(role, 'admin')) return;
    try {
      await api.updateResourceStatus(id, 'pending');
    } catch (e) {
      console.error('Reset to pending failed:', e);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.deleteResource(id);
    } catch (e) {
      console.error('Delete failed:', e);
    }
  };

  const handleRoleChange = async (targetUid: string, role: UserRole) => {
    if (!isAtLeastRole(normalizeRole(user.role), 'admin')) return;
    try {
      await api.updateUserRole(targetUid, role);
      setUsersList(prev => prev.map(u => (u.uid === targetUid ? { ...u, role } : u)));
    } catch (e) {
      console.error('Role update failed:', e);
    }
  };

  const handleDisableToggle = async (targetUid: string, disabled: boolean) => {
    if (!isAtLeastRole(normalizeRole(user.role), 'admin')) return;
    try {
      await api.setUserDisabled(targetUid, disabled);
      setUsersList(prev => prev.map(u => (u.uid === targetUid ? { ...u, disabled } : u)));
    } catch (e) {
      console.error('Disable update failed:', e);
    }
  };

  const filteredUsers = useMemo(() => {
    const q = userSearchTerm.trim().toLowerCase();
    if (!q) return usersList;
    return usersList.filter(u =>
      (u.displayName?.toLowerCase() || '').includes(q) ||
      (u.email?.toLowerCase() || '').includes(q) ||
      (u.collegeEmail?.toLowerCase() || '').includes(q) ||
      (u.branch?.toLowerCase() || '').includes(q) ||
      (u.year?.toLowerCase() || '').includes(q) ||
      (u.section?.toLowerCase() || '').includes(q) ||
      (u.dateOfBirth?.toLowerCase() || '').includes(q) ||
      (u.uid?.toLowerCase() || '').includes(q)
    );
  }, [usersList, userSearchTerm]);

  useEffect(() => {
    if (activeTab !== 'users') return;
    if (isLoadingUsers) return;
    if (!filteredUsers.length) {
      setSelectedUserId(null);
      return;
    }

    // Keep selection stable if still present; else select first result.
    if (selectedUserId && filteredUsers.some(u => u.uid === selectedUserId)) return;
    setSelectedUserId(filteredUsers[0].uid);
  }, [activeTab, isLoadingUsers, filteredUsers, selectedUserId]);

  const selectedUser = useMemo(() => {
    if (!selectedUserId) return null;
    return usersList.find(u => u.uid === selectedUserId) || null;
  }, [usersList, selectedUserId]);

  const filteredResources = useMemo(() => {
    const q = resourceSearchTerm.trim().toLowerCase();
    if (!q) return allResources;
    return allResources.filter(r => {
      return (
        (r.title || '').toLowerCase().includes(q) ||
        (r.subject || '').toLowerCase().includes(q) ||
        (r.type || '').toLowerCase().includes(q) ||
        (r.branch || '').toLowerCase().includes(q) ||
        (r.semester || '').toLowerCase().includes(q) ||
        (r.status || 'approved').toLowerCase().includes(q) ||
        (r.ownerId || '').toLowerCase().includes(q)
      );
    });
  }, [allResources, resourceSearchTerm]);

  const statusBadge = (status?: Resource['status']) => {
    const s = status || 'approved';
    if (s === 'approved') return 'bg-green-500/10 text-green-400 border-green-500/20';
    if (s === 'rejected') return 'bg-red-500/10 text-red-400 border-red-500/20';
    return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20';
  };

  const StatCard = ({ title, value, icon: Icon }: { title: string; value: React.ReactNode; icon: any }) => (
    <div className="bg-card border border-border p-6 rounded-2xl relative overflow-hidden shadow-sm">
      <div className="absolute top-0 right-0 p-4 opacity-10">
        <Icon className="w-16 h-16 text-primary" />
      </div>
      <div className="relative z-10">
        <p className="text-muted-foreground text-sm font-medium mb-1">{title}</p>
        <h3 className="text-3xl font-bold text-foreground">{value}</h3>
      </div>
    </div>
  );

  const totalUsers = isAtLeastRole(role, 'admin') ? usersList.length : undefined;
  const pendingCount = pendingResources.length;
  const totalResources = allResources.length;

  return (
    <div className="pt-6 pb-10 px-4 max-w-7xl mx-auto sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground mb-2">Admin Dashboard</h1>
        <p className="text-muted-foreground">Moderate resources and manage users</p>
      </div>

      {/* Navigation Tabs */}
      <div className="flex gap-2 mb-6 border-b border-border pb-1 overflow-x-auto scrollbar-hide">
        <button
          onClick={() => setActiveTab('overview')}
          className={`pb-3 px-4 text-sm font-medium transition-colors relative ${
            activeTab === 'overview'
              ? 'text-primary'
              : 'text-muted-foreground hover:text-foreground'
          } whitespace-nowrap`}
        >
          Overview
          {activeTab === 'overview' && (
            <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
          )}
        </button>
        <button
          onClick={() => setActiveTab('approvals')}
          className={`pb-3 px-4 text-sm font-medium transition-colors relative ${
            activeTab === 'approvals' 
              ? 'text-primary' 
              : 'text-muted-foreground hover:text-foreground'
          } whitespace-nowrap`}
        >
          Pending Approvals
          {activeTab === 'approvals' && (
            <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
          )}
        </button>
        <button
          onClick={() => setActiveTab('resources')}
          className={`pb-3 px-4 text-sm font-medium transition-colors relative ${
            activeTab === 'resources'
              ? 'text-primary'
              : 'text-muted-foreground hover:text-foreground'
          } whitespace-nowrap`}
        >
          Manage Resources
          {activeTab === 'resources' && (
            <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
          )}
        </button>

        <button
          onClick={() => setActiveTab('users')}
          disabled={!isAtLeastRole(role, 'admin')}
          className={`pb-3 px-4 text-sm font-medium transition-colors relative ${
            activeTab === 'users' 
              ? 'text-primary' 
              : 'text-muted-foreground hover:text-foreground'
          } ${!isAtLeastRole(role, 'admin') ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          User Database
          {activeTab === 'users' && (
            <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
          )}
        </button>
      </div>

      <motion.div 
        key={activeTab}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm"
      >
        {activeTab === 'overview' ? (
          <>
            <div className="p-6 border-b border-border flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-foreground">Overview</h2>
                <p className="text-sm text-muted-foreground">Quick stats and moderation shortcuts</p>
              </div>
              <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-primary/10 text-primary border border-primary/20">
                {isAtLeastRole(role, 'admin') ? 'Administrator' : 'Moderator'}
              </span>
            </div>

            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                <StatCard
                  title="Pending Approvals"
                  value={pendingCount}
                  icon={Shield}
                />
                <StatCard
                  title="Total Resources"
                  value={isLoadingResources ? '…' : totalResources}
                  icon={FileText}
                />
                <StatCard
                  title="Registered Users"
                  value={isAtLeastRole(role, 'admin') ? (isLoadingUsers ? '…' : (totalUsers ?? 0)) : '—'}
                  icon={Users}
                />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <button
                  onClick={() => setActiveTab('approvals')}
                  className="bg-muted/30 border border-border rounded-2xl p-5 text-left hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-2 text-foreground font-semibold">
                    <Check className="w-5 h-5 text-primary" />
                    Review approvals
                  </div>
                  <div className="text-sm text-muted-foreground mt-2">Approve or reject newly submitted resources.</div>
                </button>

                <button
                  onClick={() => setActiveTab('resources')}
                  className="bg-muted/30 border border-border rounded-2xl p-5 text-left hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-2 text-foreground font-semibold">
                    <Search className="w-5 h-5 text-primary" />
                    Manage resources
                  </div>
                  <div className="text-sm text-muted-foreground mt-2">Search, review, and delete resources.</div>
                </button>

                <button
                  onClick={() => setActiveTab('users')}
                  disabled={!isAtLeastRole(role, 'admin')}
                  className={`bg-muted/30 border border-border rounded-2xl p-5 text-left hover:bg-muted/50 transition-colors ${
                    !isAtLeastRole(role, 'admin') ? 'opacity-50 cursor-not-allowed hover:bg-muted/30' : ''
                  }`}
                >
                  <div className="flex items-center gap-2 text-foreground font-semibold">
                    <Users className="w-5 h-5 text-primary" />
                    User database
                  </div>
                  <div className="text-sm text-muted-foreground mt-2">Roles, disable/enable, and profile lookup.</div>
                </button>
              </div>
            </div>
          </>
        ) : activeTab === 'approvals' ? (
          <>
            <div className="p-6 border-b border-border flex justify-between items-center">
              <h2 className="text-lg font-bold text-foreground">Pending Resource Approvals</h2>
              <span className="px-2 py-1 bg-yellow-500/10 text-yellow-500 text-xs rounded-full border border-yellow-500/20">
                {pendingResources.length} Pending
              </span>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-white/5 bg-white/5">
                    <th className="p-4 text-xs font-medium text-gray-400 uppercase tracking-wider">Title</th>
                    <th className="p-4 text-xs font-medium text-gray-400 uppercase tracking-wider">Subject</th>
                    <th className="p-4 text-xs font-medium text-gray-400 uppercase tracking-wider">Details</th>
                    <th className="p-4 text-xs font-medium text-gray-400 uppercase tracking-wider text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {isLoadingApprovals ? (
                    <tr>
                      <td colSpan={4} className="p-8 text-center text-gray-500">
                        Loading pending resources...
                      </td>
                    </tr>
                  ) : pendingResources.length > 0 ? (
                    pendingResources.map((item) => (
                      <tr key={item.id} className="hover:bg-white/5 transition-colors">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-primary/10 rounded-lg text-primary">
                            <FileText className="w-5 h-5" />
                          </div>
                          <div>
                            <p className="text-white font-medium">{item.title}</p>
                            <p className="text-xs text-gray-500">ID: {item.id}</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-4 text-gray-300">{item.subject}</td>
                      <td className="p-4">
                        <div className="flex gap-2">
                          <span className="px-2 py-1 bg-gray-800 rounded text-xs text-gray-400">{item.branch}</span>
                          <span className="px-2 py-1 bg-gray-800 rounded text-xs text-gray-400">{item.semester}</span>
                          <span className="px-2 py-1 bg-gray-800 rounded text-xs text-gray-400">{item.type}</span>
                        </div>
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button 
                            onClick={() => handleApprove(item.id)}
                            className="p-2 bg-green-500/10 text-green-500 hover:bg-green-500/20 rounded-lg transition-colors"
                            title="Approve"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => handleReject(item.id)}
                            className="p-2 bg-red-500/10 text-red-500 hover:bg-red-500/20 rounded-lg transition-colors"
                            title="Reject"
                          >
                            <X className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => {
                              if (window.confirm('Delete this resource?')) handleDelete(item.id);
                            }}
                            className="px-3 py-2 bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white rounded-lg transition-colors inline-flex items-center gap-2"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                            <span className="hidden sm:inline text-xs font-medium">Delete</span>
                          </button>
                        </div>
                      </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="p-8 text-center text-gray-500">
                        No pending resources.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        ) : activeTab === 'resources' ? (
          <>
            <div className="p-6 border-b border-white/10 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h2 className="text-lg font-bold text-white">All Resources</h2>
                <p className="text-xs text-gray-500 mt-1">
                  Showing {filteredResources.length} resources
                </p>
              </div>

              <div className="relative w-full sm:w-auto">
                <Search className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search resources..."
                  value={resourceSearchTerm}
                  onChange={(e) => setResourceSearchTerm(e.target.value)}
                  className="pl-9 pr-4 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-primary/50 w-full sm:w-80"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-white/5 bg-white/5">
                    <th className="p-4 text-xs font-medium text-gray-400 uppercase tracking-wider">Title</th>
                    <th className="p-4 text-xs font-medium text-gray-400 uppercase tracking-wider">Status</th>
                    <th className="p-4 text-xs font-medium text-gray-400 uppercase tracking-wider">Details</th>
                    <th className="p-4 text-xs font-medium text-gray-400 uppercase tracking-wider text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {isLoadingResources ? (
                    <tr>
                      <td colSpan={4} className="p-8 text-center text-gray-500">
                        Loading resources...
                      </td>
                    </tr>
                  ) : filteredResources.length > 0 ? (
                    filteredResources.map((item) => (
                      <tr key={item.id} className="hover:bg-white/5 transition-colors">
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-primary/10 rounded-lg text-primary">
                              <FileText className="w-5 h-5" />
                            </div>
                            <div>
                              <p className="text-white font-medium">{item.title}</p>
                              <p className="text-xs text-gray-500">{item.subject}</p>
                            </div>
                          </div>
                        </td>
                        <td className="p-4">
                          <span className={`inline-flex px-2 py-1 rounded-full text-xs border ${statusBadge(item.status)}`}>
                            {(item.status || 'approved').toUpperCase()}
                          </span>
                          {item.status === 'rejected' && item.rejectionReason ? (
                            <div className="text-xs text-gray-500 mt-1 line-clamp-1" title={item.rejectionReason}>
                              {item.rejectionReason}
                            </div>
                          ) : null}
                        </td>
                        <td className="p-4">
                          <div className="flex flex-wrap gap-2">
                            <span className="px-2 py-1 bg-gray-800 rounded text-xs text-gray-400">{item.branch}</span>
                            <span className="px-2 py-1 bg-gray-800 rounded text-xs text-gray-400">Sem {item.semester}</span>
                            <span className="px-2 py-1 bg-gray-800 rounded text-xs text-gray-400">{item.type}</span>
                            {item.ownerId ? (
                              <span className="px-2 py-1 bg-gray-800 rounded text-xs text-gray-500" title={item.ownerId}>
                                Owner: {item.ownerId.substring(0, 8)}...
                              </span>
                            ) : null}
                          </div>
                        </td>
                        <td className="p-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => window.open(item.downloadUrl, '_blank', 'noopener,noreferrer')}
                              className="p-2 bg-white/5 text-gray-300 hover:bg-white/10 hover:text-white rounded-lg transition-colors"
                              title="Open link"
                            >
                              <ExternalLink className="w-4 h-4" />
                            </button>

                            {(item.status || 'approved') !== 'approved' && (
                              <button
                                onClick={() => handleApprove(item.id)}
                                className="p-2 bg-green-500/10 text-green-500 hover:bg-green-500/20 rounded-lg transition-colors"
                                title="Approve"
                              >
                                <Check className="w-4 h-4" />
                              </button>
                            )}

                            {(item.status || 'approved') !== 'rejected' && (
                              <button
                                onClick={() => {
                                  const reason = window.prompt('Rejection reason (optional):', item.rejectionReason || '') ?? '';
                                  handleReject(item.id, reason);
                                }}
                                className="p-2 bg-red-500/10 text-red-500 hover:bg-red-500/20 rounded-lg transition-colors"
                                title="Reject"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            )}

                            {isAtLeastRole(role, 'admin') && (item.status || 'approved') !== 'pending' && (
                              <button
                                onClick={() => handleResetToPending(item.id)}
                                className="px-2 py-2 bg-yellow-500/10 text-yellow-400 hover:bg-yellow-500/20 rounded-lg transition-colors text-xs font-medium"
                                title="Reset to pending"
                              >
                                Pending
                              </button>
                            )}

                            <button
                              onClick={() => {
                                if (window.confirm('Delete this resource?')) handleDelete(item.id);
                              }}
                              className="px-3 py-2 bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white rounded-lg transition-colors inline-flex items-center gap-2"
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4" />
                              <span className="hidden sm:inline text-xs font-medium">Delete</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="p-8 text-center text-gray-500">
                        No resources found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <>
            <div className="p-6 border-b border-white/10 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h2 className="text-lg font-bold text-white">User Database</h2>
                <p className="text-xs text-gray-500 mt-1">
                  Showing {filteredUsers.length} registered users
                </p>
              </div>
              
              <div className="relative">
                <Search className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input 
                  type="text" 
                  placeholder="Search users..." 
                  value={userSearchTerm}
                  onChange={(e) => setUserSearchTerm(e.target.value)}
                  className="pl-9 pr-4 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-primary/50 w-full sm:w-64"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-0 md:gap-6">
              {/* User list */}
              <div className="border-b border-white/10 md:border-b-0 md:border-r md:border-white/10">
                {isLoadingUsers ? (
                  <div className="p-8 text-center text-gray-500">Loading users...</div>
                ) : filteredUsers.length > 0 ? (
                  <div className="max-h-[70vh] overflow-auto divide-y divide-white/5">
                    {filteredUsers.map((u) => {
                      const isActive = u.uid === selectedUserId;
                      const subtitleParts = [u.branch, u.year, u.section].filter(Boolean);
                      return (
                        <button
                          key={u.uid}
                          onClick={() => setSelectedUserId(u.uid)}
                          className={`w-full text-left p-4 flex items-center gap-3 transition-colors ${
                            isActive ? 'bg-white/10' : 'hover:bg-white/5'
                          }`}
                        >
                          <img
                            src={u.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(u.displayName || 'User')}`}
                            alt={u.displayName || 'User'}
                            className="w-10 h-10 rounded-full bg-white/10"
                          />
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-white font-medium text-sm truncate">{u.displayName || 'No Name'}</p>
                              {u.disabled ? (
                                <span className="shrink-0 inline-flex px-2 py-0.5 rounded text-[10px] font-medium bg-red-500/10 text-red-400 border border-red-500/20">
                                  Disabled
                                </span>
                              ) : null}
                            </div>
                            <p className="text-xs text-gray-500 truncate">{u.email || u.collegeEmail || u.uid}</p>
                            {subtitleParts.length ? (
                              <p className="text-[11px] text-gray-400 truncate">{subtitleParts.join(' • ')}</p>
                            ) : (
                              <p className="text-[11px] text-gray-600 italic">Incomplete profile</p>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="p-8 text-center text-gray-500">No users found matching search.</div>
                )}
              </div>

              {/* Detail panel */}
              <div className="md:col-span-2 p-6">
                {!selectedUser ? (
                  <div className="text-gray-500 text-sm">Select a user to view details.</div>
                ) : (
                  <div className="bg-white/5 border border-white/10 rounded-xl p-6">
                    <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                      <img
                        src={selectedUser.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(selectedUser.displayName || 'User')}`}
                        alt={selectedUser.displayName || 'User'}
                        className="w-16 h-16 rounded-full bg-white/10"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                          <div>
                            <h3 className="text-white font-bold text-lg truncate">{selectedUser.displayName || 'No Name'}</h3>
                            <p className="text-sm text-gray-400 truncate">{selectedUser.email || '-'}</p>
                            {selectedUser.collegeEmail ? (
                              <div className="mt-1 flex items-center gap-2 text-sm text-gray-300">
                                <Mail className="w-4 h-4 text-gray-500" />
                                <span className="truncate">{selectedUser.collegeEmail}</span>
                              </div>
                            ) : null}
                          </div>

                          <div className="flex flex-wrap items-center gap-2">
                            <select
                              value={selectedUser.role || 'student'}
                              onChange={(e) => handleRoleChange(selectedUser.uid, e.target.value as UserRole)}
                              className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-200"
                            >
                              <option value="student">Student</option>
                              <option value="instructor">Instructor</option>
                              <option value="moderator">Moderator</option>
                              <option value="admin">Admin</option>
                              <option value="super_admin">Super Admin</option>
                            </select>
                            <button
                              onClick={() => handleDisableToggle(selectedUser.uid, !selectedUser.disabled)}
                              className={`px-3 py-2 rounded-lg text-sm border transition-colors ${
                                selectedUser.disabled
                                  ? 'bg-green-500/10 text-green-400 border-green-500/20 hover:bg-green-500/20'
                                  : 'bg-red-500/10 text-red-400 border-red-500/20 hover:bg-red-500/20'
                              }`}
                              title={selectedUser.disabled ? 'Enable user' : 'Disable user'}
                            >
                              {selectedUser.disabled ? 'Enable' : 'Disable'}
                            </button>
                          </div>
                        </div>

                        <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="bg-black/20 border border-white/10 rounded-lg p-4">
                            <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Academic</p>
                            <p className="text-sm text-gray-200">
                              <span className="text-gray-500">Branch:</span> {selectedUser.branch || '-'}
                            </p>
                            <p className="text-sm text-gray-200">
                              <span className="text-gray-500">Year:</span> {selectedUser.year || '-'}
                            </p>
                            <p className="text-sm text-gray-200">
                              <span className="text-gray-500">Section:</span> {selectedUser.section || '-'}
                            </p>
                          </div>

                          <div className="bg-black/20 border border-white/10 rounded-lg p-4">
                            <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Verification</p>
                            <p className="text-sm text-gray-200">
                              <span className="text-gray-500">DOB:</span>{' '}
                              {selectedUser.dateOfBirth ? (
                                <span className="inline-flex items-center gap-1.5">
                                  <Calendar className="w-4 h-4 text-gray-500" />
                                  {selectedUser.dateOfBirth}
                                </span>
                              ) : (
                                '-'
                              )}
                            </p>
                            <p className="text-sm text-gray-200">
                              <span className="text-gray-500">Profile:</span>{' '}
                              {selectedUser.displayName && selectedUser.dateOfBirth && selectedUser.collegeEmail && selectedUser.branch && selectedUser.year && selectedUser.section
                                ? 'Complete'
                                : 'Incomplete'}
                            </p>
                          </div>
                        </div>

                        <div className="mt-5">
                          <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">User ID</p>
                          <code className="text-xs text-gray-300 bg-black/30 border border-white/10 px-2 py-1 rounded font-mono break-all inline-block">
                            {selectedUser.uid}
                          </code>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </motion.div>
    </div>
  );
};

export default AdminDashboard;
