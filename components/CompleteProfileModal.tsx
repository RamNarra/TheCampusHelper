
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { User, Calendar, BookOpen, GraduationCap, ArrowRight, Loader2 } from 'lucide-react';

interface CompleteProfileModalProps {
  isOpen: boolean;
  onComplete?: () => void;
}

const CompleteProfileModal: React.FC<CompleteProfileModalProps> = ({ isOpen, onComplete }) => {
  const { user, updateProfile } = useAuth();
  
  const [formData, setFormData] = useState({
    displayName: user?.displayName || '',
    dateOfBirth: '',
    branch: user?.branch || '',
    year: user?.year || '',
  });
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Update form if user data loads late
  React.useEffect(() => {
    if (user) {
        setFormData(prev => ({
            ...prev,
            displayName: prev.displayName || user.displayName || '',
            branch: prev.branch || user.branch || '',
            year: prev.year || user.year || ''
        }));
    }
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!formData.displayName || !formData.dateOfBirth || !formData.branch || !formData.year) {
      setError('Please fill in all fields to continue.');
      return;
    }

    setLoading(true);
    try {
      await updateProfile({
        displayName: formData.displayName,
        dateOfBirth: formData.dateOfBirth,
        branch: formData.branch as any,
        year: formData.year
      });
      
      // Artificial delay to ensure DB sync feels smooth, then trigger completion
      setTimeout(() => {
        setLoading(false);
        if (onComplete) {
            onComplete();
        }
      }, 500);

    } catch (err) {
      setError('Failed to save profile. Please try again.');
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
                        className="w-full bg-muted/50 border border-border rounded-lg px-4 py-2.5 text-foreground focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                        placeholder="John Doe"
                    />
                </div>

                 {/* Date of Birth */}
                 <div className="space-y-1.5">
                    <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                        <Calendar className="w-3 h-3" /> Date of Birth
                    </label>
                    <input
                        type="date"
                        value={formData.dateOfBirth}
                        onChange={(e) => setFormData({...formData, dateOfBirth: e.target.value})}
                        className="w-full bg-muted/50 border border-border rounded-lg px-4 py-2.5 text-foreground focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
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
                                className="w-full bg-muted/50 border border-border rounded-lg px-4 py-2.5 text-foreground appearance-none focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                            >
                                <option value="" disabled>Select Branch</option>
                                <option value="CS_IT_DS">CSE / IT / DS</option>
                                <option value="AIML_ECE_CYS">AIML / ECE / CYS</option>
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
                                className="w-full bg-muted/50 border border-border rounded-lg px-4 py-2.5 text-foreground appearance-none focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                            >
                                <option value="" disabled>Select Year</option>
                                <option value="1">1st Year</option>
                                <option value="2">2nd Year</option>
                                <option value="3">3rd Year</option>
                                <option value="4">4th Year</option>
                            </select>
                            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground">
                                <svg width="10" height="6" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                            </div>
                        </div>
                    </div>
                </div>

                {error && (
                    <p className="text-red-500 text-sm text-center bg-red-500/10 py-2 rounded-lg border border-red-500/20">{error}</p>
                )}

                <button
                    type="submit"
                    disabled={loading}
                    className="w-full flex items-center justify-center gap-2 py-3 bg-primary text-white font-semibold rounded-xl hover:bg-primary/90 transition-all shadow-lg shadow-primary/25 disabled:opacity-50 disabled:cursor-not-allowed mt-2"
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
