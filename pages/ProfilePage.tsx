import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { motion } from 'framer-motion';
import { LogOut, RefreshCw } from 'lucide-react';
import { Navigate } from 'react-router-dom';
import { linkAndFetchStudentProfile, StudentProfileDoc } from '../core/firebase/students';
import { AcademicProfile } from '../features/profile/components/AcademicProfile';
import { isAuthBypassed } from '../lib/dev';

const ProfilePage: React.FC = () => {
  const { user, logout } = useAuth();
  const [studentDoc, setStudentDoc] = useState<StudentProfileDoc | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadAcademicProfile() {
      setLoading(true);
      if (user) {
        const docData = await linkAndFetchStudentProfile(user.uid, user.email, user.displayName);
        setStudentDoc(docData);
      } else if (isAuthBypassed()) {
        // Fallback preview student record (e.g. BODDU HARIKA - 25311A6601)
        const sampleDoc = await linkAndFetchStudentProfile('preview-user', '25311A6601@sreenidhi.edu.in', 'BODDU HARIKA');
        setStudentDoc(sampleDoc);
      }
      setLoading(false);
    }
    loadAcademicProfile();
  }, [user]);

  if (!user && !isAuthBypassed()) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="pt-6 pb-12 bg-background min-h-[calc(100vh-4rem)]">
      {/* Header bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-foreground">Student Dashboard</h1>
          <p className="text-sm text-muted-foreground">Official SNIST Academic Profile & Performance Marks</p>
        </div>
        {user && (
          <button
            onClick={logout}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-rose-500/10 text-rose-500 hover:bg-rose-500/20 text-sm font-semibold transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Logout
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center min-h-[400px]">
          <RefreshCw className="w-8 h-8 text-primary animate-spin mb-3" />
          <p className="text-sm font-medium text-muted-foreground">Fetching academic records from Firestore...</p>
        </div>
      ) : studentDoc ? (
        <AcademicProfile student={studentDoc} />
      ) : (
        <div className="max-w-3xl mx-auto my-12 p-8 bg-card border border-border rounded-3xl text-center space-y-4">
          <h2 className="text-xl font-bold text-foreground">Academic Profile Linkage Needed</h2>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            We couldn't automatically match your Google sign-in email with your college roll number.
            Ensure you sign in with your official Sreenidhi email (e.g. <code>25311A6601@sreenidhi.edu.in</code>).
          </p>
        </div>
      )}
    </div>
  );
};

export default ProfilePage;
