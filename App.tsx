import React, { useEffect, useState, ErrorInfo, ReactNode } from 'react';
import { HashRouter as Router, Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import ProfilePage from './pages/ProfilePage';
import AdminDashboard from './pages/AdminDashboard';
import ResourcesPage from './pages/ResourcesPage';
import CalculatorPage from './pages/CalculatorPage';
import CompilerPage from './pages/CompilerPage';
import QuizPage from './pages/QuizPage';
import StudyAssistantPage from './pages/StudyAssistantPage';
import NotFoundPage from './pages/NotFoundPage';
import LeaderboardPage from './pages/LeaderboardPage';
import CompleteProfileModal from './components/CompleteProfileModal';
import OnboardingTour from './components/OnboardingTour';
import PWAInstallPrompt from './components/PWAInstallPrompt';
import PWAUpdatePrompt from './components/PWAUpdatePrompt';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { Loader2 } from 'lucide-react';
import EventsPage from './pages/EventsPage';
import ExamPrepPage from './pages/ExamPrepPage';
import StudyGroupsPage from './pages/StudyGroupsPage';
import AnalyticsPage from './pages/AnalyticsPage';
import StudyPlusPage from './pages/StudyPlusPage';
import DeveloperPage from './pages/DeveloperPage';
import ToDoPage from './pages/ToDoPage';

interface ErrorBoundaryProps {
  children?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  declare props: Readonly<ErrorBoundaryProps>;

  public state: ErrorBoundaryState = {
    hasError: false,
    error: null
  };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background text-foreground p-6 text-center">
          <div className="max-w-md">
            <h1 className="text-2xl font-bold text-destructive mb-4">Something went wrong</h1>
            <p className="text-muted-foreground mb-6">The application encountered an unexpected error.</p>
            <button 
              onClick={() => window.location.reload()}
              className="px-6 py-2 bg-primary text-primary-foreground rounded font-bold hover:bg-primary/90"
            >
              Reload Application
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const Analytics = () => {
  const location = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location]);
  return null;
};

const AppContent: React.FC = () => {
  const { user, loading, profileLoaded } = useAuth();
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showTour, setShowTour] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // CONDITION: Show modal ONLY when:
    // 1. Auth is done (!loading)
    // 2. User is logged in (!!user)
    // 3. Profile fetch returned (profileLoaded)
    // 4. Profile data is actually incomplete
    
    if (!loading && user && profileLoaded) {
      const isProfileIncomplete = (
        !user.displayName ||
        !user.dateOfBirth ||
        !user.collegeEmail ||
        !user.branch ||
        !user.year ||
        !user.section
      );

      let suppressModal = false;
      try {
        const completedAtRaw = localStorage.getItem('thc_profile_completed_at');
        const completedAt = completedAtRaw ? Number(completedAtRaw) : 0;
        // Suppress immediate re-open while profile write propagates
        suppressModal = completedAt > 0 && Date.now() - completedAt < 15000;
        if (!isProfileIncomplete) {
          localStorage.removeItem('thc_profile_completed_at');
          localStorage.removeItem('thc_profile_completed');
        }
      } catch {
        suppressModal = false;
      }

      if (isProfileIncomplete && !suppressModal) {
        setShowProfileModal(true);
      } else {
        setShowProfileModal(false);
      }
    } else {
      setShowProfileModal(false);
    }
  }, [user, loading, profileLoaded]);

  const handleProfileComplete = () => {
    // Mark locally to prevent immediate re-pop if DB write is slow
    try {
      localStorage.setItem('thc_profile_completed_at', String(Date.now()));
      // Backward-compat for older builds
      localStorage.setItem('thc_profile_completed', '1');
    } catch {
      // Ignore storage failures
    }
    setShowProfileModal(false);
    navigate('/');
    setShowTour(true);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground font-sans selection:bg-primary/30 transition-colors duration-300">
      <Analytics />
      <Navbar />
      {/* Offset for fixed navbar (h-16) */}
      <div className="h-16 shrink-0" />
      
      <CompleteProfileModal isOpen={showProfileModal} onComplete={handleProfileComplete} />
      <OnboardingTour isOpen={showTour} onClose={() => setShowTour(false)} />
      
      {/* PWA Features */}
      <PWAInstallPrompt />
      <PWAUpdatePrompt />
      
      <main className="flex-grow relative flex flex-col">
        <ErrorBoundary>
            <Routes>
              <Route path="/" element={<LandingPage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/profile" element={<ProfilePage />} />
              <Route path="/admin" element={<AdminDashboard />} />
              <Route path="/resources" element={<ResourcesPage />} />
              <Route path="/quiz" element={<QuizPage />} />
              <Route path="/calculator" element={<CalculatorPage />} />
              <Route path="/compiler" element={<CompilerPage />} />
              <Route path="/events" element={<EventsPage />} />
              <Route path="/leaderboard" element={<LeaderboardPage />} />
              <Route path="/exam-prep" element={<ExamPrepPage />} />
              <Route path="/study-groups" element={<StudyGroupsPage />} />
              <Route path="/analytics" element={<AnalyticsPage />} />
              <Route path="/study-assistant" element={<StudyAssistantPage />} />
              <Route path="/study-plus" element={<StudyPlusPage />} />
              <Route path="/todo" element={<ToDoPage />} />
              <Route path="/developer" element={<DeveloperPage />} />
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
        </ErrorBoundary>
      </main>
      
      <Footer />
    </div>
  );
};

const App: React.FC = () => {
  return (
    <AuthProvider>
      <ThemeProvider>
        <Router>
          <AppContent />
        </Router>
      </ThemeProvider>
    </AuthProvider>
  );
};

export default App;
