import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Lock, ShieldCheck, ArrowRight, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Button } from './ui/Button';

interface AccessGateProps {
  isOpen: boolean;
  onClose: () => void;
  resourceTitle?: string;
}

const AccessGate: React.FC<AccessGateProps> = ({ isOpen, onClose, resourceTitle }) => {
  const { signInWithGoogle } = useAuth();

  const handleLogin = async () => {
    await signInWithGoogle();
    onClose(); // Close modal after successful login
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center px-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-background/70 backdrop-blur-sm backdrop-brightness-50"
          />

          {/* Modal */}
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            className="relative w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-2xl overflow-hidden"
          >
            {/* Background Effects */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-[50px] -translate-y-1/2 translate-x-1/2"></div>
            <div className="absolute bottom-0 left-0 w-32 h-32 bg-secondary/10 rounded-full blur-[50px] translate-y-1/2 -translate-x-1/2"></div>

            <Button
              onClick={onClose}
              variant="ghost"
              size="sm"
              className="absolute right-4 top-4 h-9 w-9 px-0 text-muted-foreground hover:text-foreground"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </Button>

            <div className="relative z-10 text-center">
              <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6 bg-muted/30 ring-1 ring-border">
                <Lock className="w-8 h-8 text-primary" />
              </div>

              <h2 className="text-2xl font-bold text-foreground mb-2">Access Restricted</h2>
              <p className="text-muted-foreground text-sm mb-6">
                You must be signed in to view or download <br/>
                <span className="text-foreground font-medium">"{resourceTitle || 'this file'}"</span>.
              </p>

              <div className="space-y-4">
                <Button
                  onClick={handleLogin}
                  className="w-full group"
                  size="lg"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      fill="#4285F4"
                    />
                    <path
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      fill="#34A853"
                    />
                    <path
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                      fill="#FBBC05"
                    />
                    <path
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                      fill="#EA4335"
                    />
                  </svg>
                  Continue with Google
                  <ArrowRight className="w-4 h-4 opacity-0 -ml-2 group-hover:opacity-100 group-hover:ml-0 transition-all" />
                </Button>
              </div>

              <div className="mt-6 flex items-center justify-center gap-2 text-[10px] text-muted-foreground uppercase tracking-widest">
                <ShieldCheck className="w-3 h-3" />
                <span>Secure Student Access</span>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default AccessGate;