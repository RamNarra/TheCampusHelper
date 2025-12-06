import React from 'react';
import { useAuth } from '../context/AuthContext';
import { pendingUploads } from '../lib/data';
import { motion } from 'framer-motion';
import { Check, X, Eye, FileText, Users, Download } from 'lucide-react';
import { Navigate } from 'react-router-dom';

const AdminDashboard: React.FC = () => {
  const { user } = useAuth();

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
        <StatCard title="Total Users" value="1,248" icon={Users} color="text-blue-500" />
        <StatCard title="Total PDFs" value="456" icon={FileText} color="text-primary" />
        <StatCard title="Total Views" value="89.2K" icon={Eye} color="text-secondary" />
      </div>

      {/* Upload Manager */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-card border border-white/10 rounded-xl overflow-hidden"
      >
        <div className="p-6 border-b border-white/10 flex justify-between items-center">
          <h2 className="text-lg font-bold text-white">Pending Approvals</h2>
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
      </motion.div>
    </div>
  );
};

export default AdminDashboard;