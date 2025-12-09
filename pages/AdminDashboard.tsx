
import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { authService } from '../services/firebase';
import { UserProfile } from '../types';
import { pendingUploads } from '../lib/data';
import { motion } from 'framer-motion';
import { Check, X, Eye, FileText, Users, Download, Search, Shield, Calendar } from 'lucide-react';
import { Navigate } from 'react-router-dom';

const AdminDashboard: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'approvals' | 'users'>('approvals');
  const [usersList, setUsersList] = useState<UserProfile[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Fetch users when tab changes to 'users'
  useEffect(() => {
    if (activeTab === 'users' && user?.role === 'admin') {
      const fetchUsers = async () => {
        setIsLoadingUsers(true);
        const data = await authService.getAllUsers();
        setUsersList(data);
        setIsLoadingUsers(false);
      };
      fetchUsers();
    }
  }, [activeTab, user]);

  if (!user || user.role !== 'admin') {
    return <Navigate to="/" replace />;
  }

  const handleApprove = (id: string) => {
    console.log(`Approving resource: ${id}`);
    // In real app, this would call Firebase function
  };

  const handleDelete = (id: string) => {
    console.log(`Deleting resource: ${id}`);
    // In real app, this would delete from Firestore
  };

  const filteredUsers = usersList.filter(u => 
    (u.displayName?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
    (u.email?.toLowerCase() || '').includes(searchTerm.toLowerCase())
  );

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
    <div className="min-h-screen pt-24 pb-12 px-4 max-w-7xl mx-auto sm:px-6 lg:px-8">
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
          onClick={() => setActiveTab('users')}
          className={`pb-3 px-4 text-sm font-medium transition-colors relative ${
            activeTab === 'users' 
              ? 'text-primary' 
              : 'text-gray-400 hover:text-white'
          }`}
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
                {pendingUploads.length} Pending
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
                  {pendingUploads.map((item) => (
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
                            onClick={() => handleDelete(item.id)}
                            className="p-2 bg-red-500/10 text-red-500 hover:bg-red-500/20 rounded-lg transition-colors"
                            title="Reject"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
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
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
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
                          {u.role === 'admin' ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-primary/10 text-primary border border-primary/20">
                              <Shield className="w-3 h-3" /> Admin
                            </span>
                          ) : (
                            <span className="inline-flex px-2 py-0.5 rounded text-xs font-medium bg-white/5 text-gray-400 border border-white/10">
                              Student
                            </span>
                          )}
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
                          <code className="text-xs text-gray-600 bg-black/20 px-1.5 py-0.5 rounded font-mono">
                            {u.uid.substring(0, 8)}...
                          </code>
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
