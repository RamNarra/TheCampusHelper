
import React, { useMemo, useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/firebase';
import { UserProfile } from '../types';
import { Resource, UserRole } from '../types';
import { motion } from 'framer-motion';
import { Check, X, Eye, FileText, Users, Download, Search, Shield, Calendar, Trash2, ExternalLink } from 'lucide-react';
import { Navigate } from 'react-router-dom';

const AdminDashboard: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'approvals' | 'resources' | 'users'>('approvals');
  const [usersList, setUsersList] = useState<UserProfile[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [userSearchTerm, setUserSearchTerm] = useState('');
  const [pendingResources, setPendingResources] = useState<Resource[]>([]);
  const [isLoadingApprovals, setIsLoadingApprovals] = useState(true);
  const [allResources, setAllResources] = useState<Resource[]>([]);
  const [isLoadingResources, setIsLoadingResources] = useState(false);
  const [resourceSearchTerm, setResourceSearchTerm] = useState('');

  // Fetch users when tab changes to 'users' (admin only)
  useEffect(() => {
    if (activeTab === 'users' && user?.role === 'admin') {
      const fetchUsers = async () => {
        setIsLoadingUsers(true);
        const data = await api.getAllUsers();
        setUsersList(data);
        setIsLoadingUsers(false);
      };
      fetchUsers();
    }
  }, [activeTab, user]);

  // Staff: subscribe to all resources for management
  useEffect(() => {
    if (activeTab !== 'resources') return;
    if (!user || (user.role !== 'admin' && user.role !== 'mod')) return;
    setIsLoadingResources(true);
    const unsub = api.onAllResourcesChanged((list) => {
      setAllResources(list);
      setIsLoadingResources(false);
    });
    return () => unsub();
  }, [activeTab, user?.role]);

  // Mods/admins: subscribe to pending resource approvals
  useEffect(() => {
    if (!user || (user.role !== 'admin' && user.role !== 'mod')) return;
    setIsLoadingApprovals(true);
    const unsub = api.onPendingResourcesChanged((list) => {
      setPendingResources(list);
      setIsLoadingApprovals(false);
    });
    return () => unsub();
  }, [user?.role]);

  if (!user || (user.role !== 'admin' && user.role !== 'mod')) {
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
    if (user.role !== 'admin') return;
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
    if (user.role !== 'admin') return;
    try {
      await api.updateUserRole(targetUid, role);
      setUsersList(prev => prev.map(u => (u.uid === targetUid ? { ...u, role } : u)));
    } catch (e) {
      console.error('Role update failed:', e);
    }
  };

  const handleDisableToggle = async (targetUid: string, disabled: boolean) => {
    if (user.role !== 'admin') return;
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
      (u.email?.toLowerCase() || '').includes(q)
    );
  }, [usersList, userSearchTerm]);

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

  const StatCard = ({ title, value, icon: Icon, color }: any) => (
    <div className="bg-card border border-white/10 p-6 rounded-xl relative overflow-hidden group">
      <div className={`absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity ${color}`}>
        <Icon className="w-16 h-16" />
      </div>
      <div className="relative z-10">
        <p className="text-gray-400 text-sm font-medium mb-1">{title}</p>
        <h3 className="text-3xl font-bold text-white">{value}</h3>
      </div>
    </div>
  );

  return (
    <div className="pt-8 pb-12 px-4 max-w-7xl mx-auto sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Admin Dashboard</h1>
        <p className="text-gray-400">Manage resources and user content</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
        <StatCard title="Registered Users" value={usersList.length || "1,248"} icon={Users} color="text-blue-500" />
        <StatCard title="Total PDFs" value="456" icon={FileText} color="text-primary" />
        <StatCard title="Total Views" value="89.2K" icon={Eye} color="text-secondary" />
      </div>

      {/* Navigation Tabs */}
      <div className="flex space-x-4 mb-6 border-b border-white/10 pb-1">
        <button
          onClick={() => setActiveTab('approvals')}
          className={`pb-3 px-4 text-sm font-medium transition-colors relative ${
            activeTab === 'approvals' 
              ? 'text-primary' 
              : 'text-gray-400 hover:text-white'
          }`}
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
              : 'text-gray-400 hover:text-white'
          }`}
        >
          Manage Resources
          {activeTab === 'resources' && (
            <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
          )}
        </button>

        <button
          onClick={() => setActiveTab('users')}
          disabled={user.role !== 'admin'}
          className={`pb-3 px-4 text-sm font-medium transition-colors relative ${
            activeTab === 'users' 
              ? 'text-primary' 
              : 'text-gray-400 hover:text-white'
          } ${user.role !== 'admin' ? 'opacity-50 cursor-not-allowed' : ''}`}
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
        className="bg-card border border-white/10 rounded-xl overflow-hidden"
      >
        {activeTab === 'approvals' ? (
          <>
            <div className="p-6 border-b border-white/10 flex justify-between items-center">
              <h2 className="text-lg font-bold text-white">Pending Resource Approvals</h2>
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
                            className="p-2 bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white rounded-lg transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
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

                            {user.role === 'admin' && (item.status || 'approved') !== 'pending' && (
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
                              className="p-2 bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white rounded-lg transition-colors"
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4" />
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
            
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-white/5 bg-white/5">
                    <th className="p-4 text-xs font-medium text-gray-400 uppercase tracking-wider">User</th>
                    <th className="p-4 text-xs font-medium text-gray-400 uppercase tracking-wider">Role</th>
                    <th className="p-4 text-xs font-medium text-gray-400 uppercase tracking-wider">Details</th>
                    <th className="p-4 text-xs font-medium text-gray-400 uppercase tracking-wider">Date of Birth</th>
                    <th className="p-4 text-xs font-medium text-gray-400 uppercase tracking-wider text-right">UID</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {isLoadingUsers ? (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-gray-500">
                        Loading users...
                      </td>
                    </tr>
                  ) : filteredUsers.length > 0 ? (
                    filteredUsers.map((u) => (
                      <tr key={u.uid} className="hover:bg-white/5 transition-colors">
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            <img 
                              src={u.photoURL || `https://ui-avatars.com/api/?name=${u.displayName}`} 
                              alt={u.displayName || 'User'} 
                              className="w-8 h-8 rounded-full bg-white/10"
                            />
                            <div>
                              <p className="text-white font-medium text-sm">{u.displayName || 'No Name'}</p>
                              <p className="text-xs text-gray-500">{u.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="p-4">
                          <div className="flex items-center gap-2">
                            <select
                              value={u.role || 'user'}
                              onChange={(e) => handleRoleChange(u.uid, e.target.value as UserRole)}
                              className="bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-xs text-gray-200"
                            >
                              <option value="user">User</option>
                              <option value="mod">Mod</option>
                              <option value="admin">Admin</option>
                            </select>
                            {u.disabled ? (
                              <span className="inline-flex px-2 py-0.5 rounded text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/20">
                                Disabled
                              </span>
                            ) : null}
                          </div>
                        </td>
                        <td className="p-4">
                          <div className="flex flex-col gap-1">
                            {u.branch && (
                              <span className="text-xs text-gray-300">
                                <span className="text-gray-500">Branch:</span> {u.branch}
                              </span>
                            )}
                            {u.year && (
                              <span className="text-xs text-gray-300">
                                <span className="text-gray-500">Year:</span> {u.year}
                              </span>
                            )}
                            {!u.branch && !u.year && <span className="text-xs text-gray-600 italic">Incomplete Profile</span>}
                          </div>
                        </td>
                        <td className="p-4 text-sm text-gray-400">
                          {u.dateOfBirth ? (
                             <div className="flex items-center gap-1.5">
                               <Calendar className="w-3.5 h-3.5 opacity-70" />
                               {u.dateOfBirth}
                             </div>
                          ) : '-'}
                        </td>
                        <td className="p-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleDisableToggle(u.uid, !u.disabled)}
                              className={`px-2 py-1 rounded text-xs border transition-colors ${
                                u.disabled
                                  ? 'bg-green-500/10 text-green-400 border-green-500/20 hover:bg-green-500/20'
                                  : 'bg-red-500/10 text-red-400 border-red-500/20 hover:bg-red-500/20'
                              }`}
                              title={u.disabled ? 'Enable user' : 'Disable user'}
                            >
                              {u.disabled ? 'Enable' : 'Disable'}
                            </button>
                            <code className="text-xs text-gray-600 bg-black/20 px-1.5 py-0.5 rounded font-mono">
                              {u.uid.substring(0, 8)}...
                            </code>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-gray-500">
                        No users found matching search.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </motion.div>
    </div>
  );
};

export default AdminDashboard;
