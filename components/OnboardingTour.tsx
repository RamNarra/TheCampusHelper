
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BookOpen, Calculator, Terminal, User, X, ArrowRight, Check, Sparkles } from 'lucide-react';
import { Button } from './ui/Button';

interface OnboardingTourProps {
  isOpen: boolean;
  onClose: () => void;
}

const steps = [
  {
    id: 'welcome',
    title: "You're All Set!",
    description: "Welcome to TheCampusHelper. Your profile is ready. Let's take a quick 30-second tour of what you can do here.",
    icon: Sparkles,
    color: "text-secondary bg-secondary/10"
  },
  {
    id: 'resources',
    title: "Academic Resources",
    description: "Access curated lecture notes, previous year question papers (PYQs), and lab manuals tailored specifically to your Branch and Year.",
    icon: BookOpen,
    color: "text-primary bg-primary/10"
  },
  {
    id: 'calculator',
    title: "CGPA Calculator",
    description: "Plan your grades effectively. Calculate your Semester SGPA and overall CGPA with our built-in grade mapping logic.",
    icon: Calculator,
    color: "text-secondary bg-secondary/10"
  },
  {
    id: 'compiler',
    title: "Online Compiler",
    description: "Need to test a code snippet quickly? Use our integrated C/C++ compiler without installing any software.",
    icon: Terminal,
    color: "text-primary bg-primary/10"
  },
  {
    id: 'profile',
    title: "Your Dashboard",
    description: "Manage your account, track your contributions, and view your saved resources from your Profile page.",
    icon: User,
    color: "text-muted-foreground bg-muted"
  }
];

const OnboardingTour: React.FC<OnboardingTourProps> = ({ isOpen, onClose }) => {
  const [currentStep, setCurrentStep] = useState(0);

  if (!isOpen) return null;

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      onClose();
    }
  };

  const handleSkip = () => {
    onClose();
  };

  const CurrentIcon = steps[currentStep].icon;

  return (
    <div className="fixed inset-0 z-[250] flex items-center justify-center px-4">
      {/* Backdrop */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-background/70 backdrop-blur-md backdrop-brightness-50"
      />

      {/* Modal */}
      <motion.div
        key={currentStep}
        initial={{ scale: 0.95, opacity: 0, x: 20 }}
        animate={{ scale: 1, opacity: 1, x: 0 }}
        exit={{ scale: 0.95, opacity: 0, x: -20 }}
        transition={{ type: "spring", duration: 0.5 }}
        className="relative w-full max-w-md bg-card border border-border rounded-2xl shadow-2xl overflow-hidden"
      >
        {/* Progress Bar */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-muted">
          <motion.div 
            className="h-full bg-primary"
            initial={{ width: `${((currentStep) / steps.length) * 100}%` }}
            animate={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>

        <Button
          onClick={handleSkip}
          variant="ghost"
          size="sm"
          className="absolute top-4 right-4 h-9 w-9 px-0 text-muted-foreground hover:text-foreground transition-colors z-10"
          aria-label="Skip tour"
        >
          <X className="w-5 h-5" />
        </Button>

        <div className="p-8 pt-12 text-center">
          <motion.div 
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 ring-4 ring-card ${steps[currentStep].color}`}
          >
            <CurrentIcon className="w-10 h-10" />
          </motion.div>

          <h2 className="text-2xl font-bold text-foreground mb-3">{steps[currentStep].title}</h2>
          <p className="text-muted-foreground leading-relaxed mb-8 min-h-[80px]">
            {steps[currentStep].description}
          </p>

          <div className="flex items-center gap-3">
            {currentStep > 0 && (
              <Button
                onClick={() => setCurrentStep(currentStep - 1)}
                variant="outline"
                size="lg"
                className="rounded-xl text-muted-foreground hover:text-foreground"
              >
                Back
              </Button>
            )}
            <Button
              onClick={handleNext}
              size="lg"
              className="flex-1 rounded-xl shadow-lg shadow-primary/25"
            >
              {currentStep === steps.length - 1 ? (
                <>Get Started <Check className="w-4 h-4" /></>
              ) : (
                <>Next <ArrowRight className="w-4 h-4" /></>
              )}
            </Button>
          </div>
          
          <div className="mt-6 flex justify-center gap-1.5">
            {steps.map((_, idx) => (
                <div 
                    key={idx}
                    className={`w-2 h-2 rounded-full transition-all duration-300 ${idx === currentStep ? 'bg-primary w-6' : 'bg-muted-foreground/30'}`}
                />
            ))}
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default OnboardingTour;
