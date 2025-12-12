
import React from 'react';
import { useAuth } from '../context/AuthContext';
import { motion } from 'framer-motion';
import { FileText, Upload, LogOut, Bookmark, FolderOpen } from 'lucide-react';
import { Navigate } from 'react-router-dom';
import GamificationCard from '../components/GamificationCard';

const ProfilePage: React.FC = () => {
  const { user, logout } = useAuth();

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="min-h-screen pt-24 pb-12 px-4 max-w-7xl mx-auto sm:px-6 lg:px-8">
      {/* Profile Header */}
      <motion.div 
        initial={{ y: 10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="bg-card border border-border rounded-2xl p-8 mb-8 relative overflow-hidden shadow-sm"
      >
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-[80px] -translate-y-1/2 translate-x-1/2"></div>
        
        <div className="flex flex-col sm:flex-row items-center gap-8 relative z-10">
          <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full border-4 border-background shadow-lg overflow-hidden bg-muted flex-shrink-0">
             <img 
                src={user.photoURL || `https://ui-avatars.com/api/?name=${user.displayName}`} 
                alt="Profile" 
                className="w-full h-full object-cover"
              />
          </div>
          <div className="text-center sm:text-left flex-1">
            <h1 className="text-3xl font-bold text-foreground mb-1">{user.displayName}</h1>
            <p className="text-base text-muted-foreground mb-4">{user.email}</p>
            <div className="flex flex-wrap justify-center sm:justify-start gap-3">
              <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-primary/10 text-primary border border-primary/20">
                {user.role === 'admin' ? 'Administrator' : 'Student'}
              </span>
              <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-secondary/10 text-secondary border border-secondary/20">
                {user.branch || 'General'}
              </span>
            </div>
          </div>
          <button 
            onClick={logout}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-colors text-sm font-medium"
          >
            <LogOut className="w-5 h-5" />
            Logout
          </button>
        </div>
      </motion.div>

      {/* Gamification Card */}
      <motion.div
        initial={{ y: 10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.05 }}
        className="mb-8"
      >
        <GamificationCard uid={user.uid} />
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Saved Notes Section */}
        <motion.div 
          initial={{ x: -10, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="bg-card border border-border rounded-2xl p-6 min-h-[300px] shadow-sm flex flex-col"
        >
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold flex items-center gap-2 text-foreground">
              <Bookmark className="w-5 h-5 text-primary" />
              Saved Notes
            </h2>
            <span className="text-xs font-medium text-muted-foreground bg-muted px-2.5 py-1 rounded-md">0 Saved</span>
          </div>
          
          <div className="flex flex-col items-center justify-center flex-1 border-2 border-dashed border-border rounded-xl bg-muted/20 p-8">
            <FolderOpen className="w-10 h-10 text-muted-foreground mb-3 opacity-50" />
            <p className="text-muted-foreground text-sm font-medium">No notes saved yet</p>
            <p className="text-xs text-muted-foreground mt-1 text-center max-w-xs">Bookmark important resources to access them quickly here.</p>
          </div>
        </motion.div>

        {/* Contributions Section */}
        <motion.div 
          initial={{ x: 10, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="bg-card border border-border rounded-2xl p-6 min-h-[300px] shadow-sm flex flex-col"
        >
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold flex items-center gap-2 text-foreground">
              <Upload className="w-5 h-5 text-secondary" />
              Contributions
            </h2>
            <button className="text-sm text-primary hover:text-primary/80 transition-colors font-semibold">
              + Upload New
            </button>
          </div>

          <div className="flex flex-col items-center justify-center flex-1 border-2 border-dashed border-border rounded-xl bg-muted/20 p-8">
            <FileText className="w-10 h-10 text-muted-foreground mb-3 opacity-50" />
            <p className="text-muted-foreground text-sm font-medium">You haven't uploaded anything</p>
            <p className="text-xs text-muted-foreground mt-1 text-center max-w-xs">Help your juniors by sharing your notes and study materials.</p>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default ProfilePage;
