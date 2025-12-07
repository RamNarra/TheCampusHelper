
import React from 'react';
import { useAuth } from '../context/AuthContext';
import { motion } from 'framer-motion';
import { FileText, Upload, LogOut, Bookmark, FolderOpen } from 'lucide-react';
import { Navigate } from 'react-router-dom';

const ProfilePage: React.FC = () => {
  const { user, logout } = useAuth();

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="min-h-screen pt-24 pb-12 px-4 max-w-7xl mx-auto sm:px-6 lg:px-8">
      {/* Profile Header */}
      <motion.div 
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="bg-card border border-border rounded-2xl p-6 sm:p-10 mb-8 relative overflow-hidden"
      >
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-[80px] -translate-y-1/2 translate-x-1/2"></div>
        
        <div className="flex flex-col sm:flex-row items-center gap-6 relative z-10">
          <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-full border-4 border-background shadow-xl overflow-hidden bg-muted">
             <img 
                src={user.photoURL || `https://ui-avatars.com/api/?name=${user.displayName}`} 
                alt="Profile" 
                className="w-full h-full object-cover"
              />
          </div>
          <div className="text-center sm:text-left flex-1">
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-2">{user.displayName}</h1>
            <p className="text-muted-foreground mb-4">{user.email}</p>
            <div className="flex flex-wrap justify-center sm:justify-start gap-2">
              <span className="px-3 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20">
                {user.role === 'admin' ? 'Administrator' : 'Student'}
              </span>
              <span className="px-3 py-1 rounded-full text-xs font-medium bg-secondary/10 text-secondary border border-secondary/20">
                {user.branch || 'General'}
              </span>
            </div>
          </div>
          <button 
            onClick={logout}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Logout
          </button>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Saved Notes Section */}
        <motion.div 
          initial={{ x: -20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="bg-card border border-border rounded-2xl p-6 min-h-[300px]"
        >
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold flex items-center gap-2 text-foreground">
              <Bookmark className="w-5 h-5 text-primary" />
              My Saved Notes
            </h2>
            <span className="text-sm text-muted-foreground">0 saved</span>
          </div>
          
          <div className="flex flex-col items-center justify-center h-[200px] border-2 border-dashed border-border rounded-xl bg-muted/30">
            <FolderOpen className="w-12 h-12 text-muted-foreground mb-3 opacity-50" />
            <p className="text-muted-foreground font-medium">No notes saved yet</p>
            <p className="text-muted-foreground text-sm mt-1">Bookmark resources to access them quickly</p>
          </div>
        </motion.div>

        {/* Contributions Section */}
        <motion.div 
          initial={{ x: 20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="bg-card border border-border rounded-2xl p-6 min-h-[300px]"
        >
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold flex items-center gap-2 text-foreground">
              <Upload className="w-5 h-5 text-secondary" />
              My Contributions
            </h2>
            <button className="text-sm text-primary hover:text-primary/80 transition-colors">
              + Upload New
            </button>
          </div>

          <div className="flex flex-col items-center justify-center h-[200px] border-2 border-dashed border-border rounded-xl bg-muted/30">
            <FileText className="w-12 h-12 text-muted-foreground mb-3 opacity-50" />
            <p className="text-muted-foreground font-medium">You haven't uploaded anything</p>
            <p className="text-muted-foreground text-sm mt-1">Help the community by sharing your notes</p>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default ProfilePage;
