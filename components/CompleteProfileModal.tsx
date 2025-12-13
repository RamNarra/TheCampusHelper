import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { User, Calendar, BookOpen, GraduationCap, ArrowRight, Loader2, Mail, Users } from 'lucide-react';
import { awardXP, XP_REWARDS } from '../services/gamification';

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
    year: user?.year || '',
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
            year: prev.year || user.year || '',
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

  const isValidCollegeEmail = (value: string): boolean => {
    const v = value.trim().toLowerCase();
    // Example format: 21/22/23/24/25xxxxx@<branch>.sreenidhi.edu.in
    // We enforce year prefix 21-25 + 4-8 digits to avoid blocking edge cases.
    return /^(21|22|23|24|25)\d{4,8}@[a-z0-9-]+\.sreenidhi\.edu\.in$/.test(v);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const dob = formData.dateOfBirth.trim();
    const collegeEmail = formData.collegeEmail.trim();
    const section = normalizeSection(formData.section);

    if (!formData.displayName.trim() || !dob || !collegeEmail || !formData.branch || !formData.year || !section) {
      setError('Please fill in all fields to continue.');
      return;
    }

    if (!isValidDob(dob)) {
      setError('Please enter DOB in DD-MM-YYYY format (valid date).');
      return;
    }

    if (!isValidCollegeEmail(collegeEmail)) {
      setError('Please enter a valid college email (e.g., 23xxxxx@cse.sreenidhi.edu.in).');
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
        branch: formData.branch as any,
        year: formData.year,
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
      <div className="absolute inset-0 bg-black/90 backdrop-blur-md" />

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
                    onChange={(e) => setFormData({...formData, collegeEmail: e.target.value})}
                    className="w-full bg-muted border border-border rounded-lg px-4 py-2.5 text-foreground placeholder:text-muted-foreground/50 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                    placeholder="23xxxxx@cse.sreenidhi.edu.in"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                    {/* Branch */}
                    <div className="space-y-1.5">
                         <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                            <BookOpen className="w-3 h-3" /> Branch
                        </label>
                        <div className="relative">
                            <select
                                value={formData.branch}
                                onChange={(e) => setFormData({...formData, branch: e.target.value})}
                                className="w-full bg-muted border border-border rounded-lg px-4 py-2.5 text-foreground appearance-none focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                            >
                                <option value="" disabled className="text-muted-foreground">Select Branch</option>
                                <option value="CS_IT_DS" className="text-foreground bg-card">CSE / IT / DS</option>
                                <option value="AIML_ECE_CYS" className="text-foreground bg-card">AIML / ECE / CYS</option>
                            </select>
                            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground">
                                <svg width="10" height="6" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                            </div>
                        </div>
                    </div>

                    {/* Year */}
                    <div className="space-y-1.5">
                        <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                            <GraduationCap className="w-3 h-3" /> Year
                        </label>
                         <div className="relative">
                            <select
                                value={formData.year}
                                onChange={(e) => setFormData({...formData, year: e.target.value})}
                                className="w-full bg-muted border border-border rounded-lg px-4 py-2.5 text-foreground appearance-none focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                            >
                                <option value="" disabled className="text-muted-foreground">Select Year</option>
                                <option value="1" className="text-foreground bg-card">1st Year</option>
                                <option value="2" className="text-foreground bg-card">2nd Year</option>
                                <option value="3" className="text-foreground bg-card">3rd Year</option>
                                <option value="4" className="text-foreground bg-card">4th Year</option>
                            </select>
                            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground">
                                <svg width="10" height="6" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                            </div>
                        </div>
                    </div>
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
                    <p className="text-red-500 text-sm text-center bg-red-500/10 py-2 rounded-lg border border-red-500/20">{error}</p>
                )}

                <button
                    type="submit"
                    disabled={loading}
                    className="w-full flex items-center justify-center gap-2 py-3 bg-primary text-white font-semibold rounded-xl hover:bg-primary/90 transition-all shadow-lg shadow-primary/25 disabled:opacity-70 disabled:cursor-not-allowed mt-2"
                >
                    {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <>Save & Continue <ArrowRight className="w-4 h-4" /></>}
                </button>
            </form>
        </div>
      </motion.div>
    </div>
  );
};

export default CompleteProfileModal;
