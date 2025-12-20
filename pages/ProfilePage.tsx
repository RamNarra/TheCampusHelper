
import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { motion } from 'framer-motion';
import { FileText, Upload, LogOut, Bookmark, FolderOpen } from 'lucide-react';
import { Navigate, NavLink } from 'react-router-dom';
import GamificationCard from '../components/GamificationCard';
import { api } from '../services/firebase';
import { isAtLeastRole, normalizeRole } from '../lib/rbac';
import { getPreviewUserId, isAuthBypassed } from '../lib/dev';

const ProfilePage: React.FC = () => {
  const { user, logout } = useAuth();
  const isPreview = !user && isAuthBypassed();
  const displayUser = user ?? (isPreview
    ? {
        uid: getPreviewUserId(),
        displayName: 'Preview User',
        email: 'preview@localhost',
        photoURL: null,
        role: 'student',
        branch: 'CS_IT_DS',
        year: '2',
        section: 'A',
      }
    : null);
  const [adminFixLoading, setAdminFixLoading] = useState(false);
  const [adminFixMessage, setAdminFixMessage] = useState<string | null>(null);

  if (!displayUser) {
    return <Navigate to="/login" replace />;
  }

  const canAttemptAdminFix = !!user && !isAtLeastRole(normalizeRole(displayUser.role), 'admin') && !adminFixLoading;

  return (
    <div className="pt-6 pb-10 px-4 max-w-7xl mx-auto sm:px-6 lg:px-8">
      {/* Profile Header */}
      <motion.div 
        initial={{ y: 10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="bg-card border border-border rounded-2xl mb-8 relative overflow-hidden shadow-sm"
      >
        {/* Banner */}
        <div className="h-28 sm:h-32 bg-primary/15 relative">
          <div className="absolute top-0 right-0 w-80 h-80 bg-primary/20 rounded-full blur-[90px] -translate-y-1/2 translate-x-1/2" />
        </div>

        {/* Body */}
        <div className="p-6 sm:p-8 pt-0 relative z-10">
          {isPreview && (
            <div className="mb-5 rounded-xl border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
              Preview mode is enabled. Sign in to edit your profile and see your real stats.
            </div>
          )}
          <div className="flex flex-col lg:flex-row gap-6 items-start">
            <div className="flex items-start gap-4 w-full lg:w-auto -mt-10">
              <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl border-4 border-card shadow-lg overflow-hidden bg-muted flex-shrink-0">
                <img
                  src={displayUser.photoURL || `https://ui-avatars.com/api/?name=${displayUser.displayName}`}
                  alt="Profile"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="pt-10 sm:pt-12">
                <h1 className="text-2xl sm:text-3xl font-bold text-foreground leading-tight">{displayUser.displayName}</h1>
                <p className="text-sm text-muted-foreground mt-1">{displayUser.email}</p>
                <div className="flex flex-wrap gap-2 mt-3">
                  <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-primary/10 text-primary border border-primary/20">
                    {isAtLeastRole(normalizeRole(displayUser.role), 'admin') ? 'Administrator' : 'Student'}
                  </span>
                  <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-secondary/10 text-secondary border border-secondary/20">
                    {displayUser.branch || 'General'}
                  </span>
                  {displayUser.year ? (
                    <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-muted text-muted-foreground border border-border">
                      Year {displayUser.year}
                    </span>
                  ) : null}
                  {displayUser.section ? (
                    <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-muted text-muted-foreground border border-border">
                      Sec {displayUser.section}
                    </span>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="flex-1 w-full">
              <div className="bg-muted/30 border border-border rounded-2xl p-5">
                <div className="flex items-center justify-between gap-4">
                  <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">About</h2>
                  <NavLink
                    to="/todo"
                    className="text-sm font-semibold text-primary hover:text-primary/80 transition-colors"
                  >
                    Open Mega Calendar
                  </NavLink>
                </div>
                <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  <div className="text-muted-foreground">
                    <span className="font-semibold text-foreground">Branch:</span> {displayUser.branch || '—'}
                  </div>
                  <div className="text-muted-foreground">
                    <span className="font-semibold text-foreground">College Email:</span> {displayUser.collegeEmail || '—'}
                  </div>
                  <div className="text-muted-foreground">
                    <span className="font-semibold text-foreground">DOB:</span> {displayUser.dateOfBirth || '—'}
                  </div>
                  <div className="text-muted-foreground">
                    <span className="font-semibold text-foreground">Role:</span> {displayUser.role}
                  </div>
                </div>

                {canAttemptAdminFix ? (
                  <div className="mt-4 flex flex-col sm:flex-row sm:items-center gap-3">
                    <button
                      disabled={!canAttemptAdminFix}
                      onClick={async () => {
                        setAdminFixLoading(true);
                        setAdminFixMessage(null);
                        try {
                          const result = await api.bootstrapAdminAccessDetailed();
                          if (!result.ok) {
                            setAdminFixMessage(`Admin restore failed (${result.status}). ${result.bodyText || ''}`.trim());
                            return;
                          }
                          await api.forceRefreshAuthToken();
                          setAdminFixMessage('Admin restore requested. Refreshing…');
                          setTimeout(() => window.location.reload(), 600);
                        } finally {
                          setAdminFixLoading(false);
                        }
                      }}
                      className="px-4 py-2 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition-colors text-sm font-semibold disabled:opacity-50"
                    >
                      {adminFixLoading ? 'Restoring…' : 'Restore Admin Access'}
                    </button>
                    {adminFixMessage ? (
                      <div className="text-xs text-muted-foreground break-words max-w-xl">{adminFixMessage}</div>
                    ) : null}
                  </div>
                ) : null}
              </div>

              <div className="mt-4">
                {user ? (
                  <button
                    onClick={logout}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-colors text-sm font-medium"
                  >
                    <LogOut className="w-5 h-5" />
                    Logout
                  </button>
                ) : (
                  <div className="text-sm text-muted-foreground">Sign in to manage your account.</div>
                )}
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Gamification Card */}
      <motion.div
        initial={{ y: 10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.05 }}
        className="mb-8"
      >
        {user ? <GamificationCard uid={user.uid} /> : null}
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
