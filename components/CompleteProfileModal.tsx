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
    branch: user?.branch || '',
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
          branch: prev.branch || user.branch || '',
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
    if (dept === 'it') return 'IT';
    if (dept === 'ds' || dept === 'datascience') return 'DS';
    if (dept === 'aiml') return 'AIML';
    if (dept === 'cys' || dept === 'cybersecurity') return 'CYS';
    if (dept === 'ece') return 'ECE';
    if (dept === 'eee') return 'EEE';
    if (dept === 'mech') return 'MECH';
    if (dept === 'civil' || dept === 'ce') return 'CIVIL';
    return null;
  };

  const inferRollNumberFromCollegeEmail = (value: string): string | null => {
    const v = (value || '').trim();
    const at = v.indexOf('@');
    if (at <= 0) return null;
    const local = v.slice(0, at).trim();
    if (!local) return null;
    // Roll numbers are typically alphanumeric and case-insensitive.
    const cleaned = local.replace(/\s+/g, '');
    if (!/^[a-zA-Z0-9]+$/.test(cleaned)) return null;
    return cleaned.toUpperCase();
  };

  const inferBatchFromRollNumber = (rollNumber: string | null): string | null => {
    const rn = (rollNumber || '').trim();
    if (rn.length < 2) return null;
    const yy = rn.slice(0, 2);
    if (!/^\d{2}$/.test(yy)) return null;
    const startYear = 2000 + parseInt(yy, 10);
    const endYear = startYear + 4;
    return `${startYear}-${endYear}`;
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

    if (!formData.displayName.trim() || !dob || !collegeEmail || !formData.branch || !section) {
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

    if (formData.branch && formData.branch !== inferredBranch) {
      setError('Branch must match your college email domain.');
      return;
    }

    const rollNumber = inferRollNumberFromCollegeEmail(collegeEmail);
    const batch = inferBatchFromRollNumber(rollNumber);

    setLoading(true);
    
    try {
      // We wrap this in a try/catch, but we allow the UI to proceed 
      // even if the backend write is slow or fails (Optimistic UI)
      await updateProfile({
        displayName: formData.displayName.trim(),
        dateOfBirth: dob,
        collegeEmail: collegeEmail,
        branch: inferredBranch,
        rollNumber: rollNumber || undefined,
        batch: batch || undefined,
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
                      const inferred = inferBranchFromCollegeEmail(nextEmail);
                      setFormData((prev) => ({
                        ...prev,
                        collegeEmail: nextEmail,
                        branch: inferred ? inferred : prev.branch,
                      }));
                    }}
                    className="w-full bg-muted border border-border rounded-lg px-4 py-2.5 text-foreground placeholder:text-muted-foreground/50 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                    placeholder="25311A05MV@cse.sreenidhi.edu.in"
                  />
                </div>

                {/* Branch */}
                <div className="space-y-1.5">
                  <label htmlFor="profile-branch" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <BookOpen className="w-3 h-3" /> Branch
                  </label>
                  <div className="relative">
                    <select
                      id="profile-branch"
                      value={formData.branch}
                      onChange={(e) => setFormData({ ...formData, branch: e.target.value })}
                      className="w-full bg-muted border border-border rounded-lg px-4 py-2.5 text-foreground appearance-none focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                    >
                      <option value="" disabled className="text-muted-foreground">Select Branch</option>
                      <option value="CSE" className="text-foreground bg-card">CSE</option>
                      <option value="IT" className="text-foreground bg-card">IT</option>
                      <option value="DS" className="text-foreground bg-card">Data Science</option>
                      <option value="AIML" className="text-foreground bg-card">AIML</option>
                      <option value="CYS" className="text-foreground bg-card">Cybersecurity</option>
                      <option value="ECE" className="text-foreground bg-card">ECE</option>
                      <option value="EEE" className="text-foreground bg-card">EEE</option>
                      <option value="MECH" className="text-foreground bg-card">Mechanical</option>
                      <option value="CIVIL" className="text-foreground bg-card">Civil</option>
                    </select>
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground">
                      <svg width="10" height="6" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Branch auto-fills from college email domain.
                  </p>
                </div>

                  {/* Section */}
                  <div className="space-y-1.5">
                    <label htmlFor="profile-section" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <Users className="w-3 h-3" /> Section
                    </label>
                    <div className="relative">
                      <select
                        id="profile-section"
                        value={formData.section}
                        onChange={(e) => setFormData({ ...formData, section: e.target.value })}
                        className="w-full bg-muted border border-border rounded-lg px-4 py-2.5 text-foreground appearance-none focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                      >
                        <option value="" disabled className="text-muted-foreground">Select Section</option>
                        {(['A','B','C','D','E','F','G','H','I'] as const).map((s) => (
                          <option key={s} value={s} className="text-foreground bg-card">{s}</option>
                        ))}
                      </select>
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground">
                        <svg width="10" height="6" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      </div>
                    </div>
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
