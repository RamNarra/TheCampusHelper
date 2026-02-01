import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { User, Calendar, BookOpen, ArrowRight, Mail, Users } from 'lucide-react';
import type { BranchKey } from '../types';
import { awardXP, XP_REWARDS } from '../services/gamification';
import { Alert } from './ui/Alert';
import { Button } from './ui/Button';
import { Spinner } from './ui/Spinner';

interface CompleteProfileModalProps {
  isOpen: boolean;
  onComplete?: () => void;
}

const CompleteProfileModal: React.FC<CompleteProfileModalProps> = ({ isOpen, onComplete }) => {
  const { user, updateProfile } = useAuth();
  
  const [formData, setFormData] = useState({
    displayName: user?.displayName || '',
    dateOfBirth: user?.dateOfBirth || '',
    section: user?.section || '',
    collegeEmail: user?.collegeEmail || '',
  });
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Sync form with user data if it arrives late
  React.useEffect(() => {
    if (user) {
        setFormData(prev => ({
            ...prev,
            displayName: prev.displayName || user.displayName || '',
            section: prev.section || user.section || '',
            collegeEmail: prev.collegeEmail || user.collegeEmail || ''
        }));
    }
  }, [user]);

  const isValidDob = (value: string): boolean => {
    // Expected format: DD-MM-YYYY
    const m = value.trim().match(/^(0[1-9]|[12]\d|3[01])-(0[1-9]|1[0-2])-(19\d{2}|20\d{2})$/);
    if (!m) return false;
    const [dd, mm, yyyy] = value.split('-').map((x) => parseInt(x, 10));
    const d = new Date(yyyy, mm - 1, dd);
    if (Number.isNaN(d.getTime())) return false;
    // Validate that JS didn't auto-roll (e.g. 31-02-2004)
    if (d.getFullYear() !== yyyy || d.getMonth() !== mm - 1 || d.getDate() !== dd) return false;
    // Not in the future
    const now = new Date();
    if (d.getTime() > now.getTime()) return false;
    return true;
  };

  const normalizeSection = (value: string): string => value.trim().toUpperCase();

  const inferBranchFromCollegeEmail = (value: string): BranchKey | null => {
    const v = (value || '').trim().toLowerCase();
    const m = v.match(/@([a-z0-9-]+)\.sreenidh(i)?\.edu\.in$/);
    if (!m) return null;
    const dept = m[1];

    if (dept === 'cse') return 'CSE';
    if (dept === 'ece') return 'ECE';
    if (dept === 'eee') return 'EEE';
    if (dept === 'mech') return 'MECH';
    if (dept === 'civil' || dept === 'ce') return 'CIVIL';
    return null;
  };

  const isValidCollegeEmail = (value: string): boolean => {
    const v = value.trim().toLowerCase();
    // Accept SNIST-style alphanumeric IDs (e.g. 25311A05MV@cse.sreenidhi.edu.in)
    // while enforcing the official domain.
    return /^[a-z0-9][a-z0-9._%+-]{1,63}@[a-z0-9-]+\.sreenidh(i)?\.edu\.in$/.test(v);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const dob = formData.dateOfBirth.trim();
    const collegeEmail = formData.collegeEmail.trim();
    const section = normalizeSection(formData.section);

    if (!formData.displayName.trim() || !dob || !collegeEmail || !section) {
      setError('Please fill in all fields to continue.');
      return;
    }

    if (!isValidDob(dob)) {
      setError('Please enter DOB in DD-MM-YYYY format (valid date).');
      return;
    }

    if (!isValidCollegeEmail(collegeEmail)) {
      setError('Please enter a valid college email (must end with @<branch>.sreenidhi.edu.in).');
      return;
    }

    const inferredBranch = inferBranchFromCollegeEmail(collegeEmail);
    if (!inferredBranch) {
      setError('College email must include your branch subdomain (e.g. 25311A05MV@cse.sreenidhi.edu.in).');
      return;
    }

    setLoading(true);
    
    try {
      // We wrap this in a try/catch, but we allow the UI to proceed 
      // even if the backend write is slow or fails (Optimistic UI)
      await updateProfile({
        displayName: formData.displayName.trim(),
        dateOfBirth: dob,
        collegeEmail: collegeEmail,
        branch: inferredBranch,
        section,
        profileCompleted: true
      });
      
      // Award XP for completing profile
      if (user) {
        await awardXP(user.uid, XP_REWARDS.PROFILE_COMPLETE, 'Completed profile');
      }
      
      if (onComplete) onComplete();

    } catch (err) {
      console.warn("Profile save warning:", err);
      // Fallback: Proceed anyway so user isn't stuck
      if (onComplete) onComplete();
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center px-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-background/70 backdrop-blur-md backdrop-brightness-50" />

      {/* Modal */}
      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        className="relative w-full max-w-lg bg-card border border-border rounded-2xl shadow-2xl overflow-hidden"
      >
        <div className="p-8">
            <div className="text-center mb-8">
                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4 ring-1 ring-primary/20">
                    <User className="w-8 h-8 text-primary" />
                </div>
                <h2 className="text-2xl font-bold text-foreground">Complete Your Profile</h2>
                <p className="text-muted-foreground text-sm mt-2">
                    Welcome! Please provide a few details to personalize your academic experience.
                </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
                {/* Full Name */}
                <div className="space-y-1.5">
                    <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                        <User className="w-3 h-3" /> Full Name
                    </label>
                    <input
                        type="text"
                        value={formData.displayName}
                        onChange={(e) => setFormData({...formData, displayName: e.target.value})}
                        className="w-full bg-muted border border-border rounded-lg px-4 py-2.5 text-foreground placeholder:text-muted-foreground/50 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                        placeholder="John Doe"
                    />
                </div>

                 {/* Date of Birth */}
                 <div className="space-y-1.5">
                    <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                        <Calendar className="w-3 h-3" /> Date of Birth
                    </label>
                    <input
                    type="text"
                    inputMode="numeric"
                    value={formData.dateOfBirth}
                    onChange={(e) => setFormData({...formData, dateOfBirth: e.target.value})}
                    className="w-full bg-muted border border-border rounded-lg px-4 py-2.5 text-foreground placeholder:text-muted-foreground/50 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                    placeholder="DD-MM-YYYY"
                    />
                </div>

                {/* College Email */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Mail className="w-3 h-3" /> College Email
                  </label>
                  <input
                    type="email"
                    value={formData.collegeEmail}
                    onChange={(e) => {
                      const nextEmail = e.target.value;
                      setFormData((prev) => ({
                        ...prev,
                        collegeEmail: nextEmail,
                      }));
                    }}
                    className="w-full bg-muted border border-border rounded-lg px-4 py-2.5 text-foreground placeholder:text-muted-foreground/50 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                    placeholder="25311A05MV@cse.sreenidhi.edu.in"
                  />
                </div>

                {/* Branch (auto-detected from college email) */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <BookOpen className="w-3 h-3" /> Branch (auto)
                  </label>
                  <input
                    type="text"
                    value={inferBranchFromCollegeEmail(formData.collegeEmail) || ''}
                    readOnly
                    className="w-full bg-muted border border-border rounded-lg px-4 py-2.5 text-foreground placeholder:text-muted-foreground/50 outline-none"
                    placeholder="Enter college email to detect"
                  />
                </div>

                  {/* Section */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <Users className="w-3 h-3" /> Section
                    </label>
                    <input
                      type="text"
                      value={formData.section}
                      onChange={(e) => setFormData({...formData, section: e.target.value})}
                      className="w-full bg-muted border border-border rounded-lg px-4 py-2.5 text-foreground placeholder:text-muted-foreground/50 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                      placeholder="A"
                    />
                  </div>

                {error && (
                    <Alert variant="destructive" title={error} />
                )}

                <Button type="submit" disabled={loading} className="w-full mt-2" size="lg">
                    {loading ? (
                      <>
                        <Spinner size="md" className="border-t-primary-foreground" />
                        Saving…
                      </>
                    ) : (
                      <>
                        Save & Continue <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                </Button>
            </form>
        </div>
      </motion.div>
    </div>
  );
};

export default CompleteProfileModal;
