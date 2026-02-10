import React, { useEffect, useState, ErrorInfo, ReactNode } from 'react';
import { HashRouter as Router, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import ProfilePage from './pages/ProfilePage';
import AdminDashboard from './pages/AdminDashboard';
import ResourcesPage from './pages/ResourcesPage';
import NotFoundPage from './pages/NotFoundPage';
import CompleteProfileModal from './components/CompleteProfileModal';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { Button } from './components/ui/Button';
import { Spinner } from './components/ui/Spinner';

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
            <Button onClick={() => window.location.reload()} className="px-6">
              Reload Application
            </Button>
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
  const { user, loading, profileLoaded, profileStatus } = useAuth();
  const isPublicBuild = import.meta.env.PROD;
  const [showProfileModal, setShowProfileModal] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const didPostAuthRedirectRef = React.useRef(false);

  useEffect(() => {
    if (!loading && user && profileLoaded) {
      setShowProfileModal(profileStatus === 'incomplete');
    } else {
      setShowProfileModal(false);
    }
  }, [user, loading, profileLoaded, profileStatus]);

  useEffect(() => {
    // Post-auth routing: always land on homepage after sign-in/session restore.
    // Never route to /profile by default.
    if (!loading && user && !didPostAuthRedirectRef.current) {
      didPostAuthRedirectRef.current = true;
      if (location.pathname !== '/') {
        navigate('/', { replace: true });
      }
    }
    if (!user) {
      didPostAuthRedirectRef.current = false;
    }
  }, [user, loading, location.pathname, navigate]);

  const handleProfileComplete = () => {
    // The modal will close automatically once Firestore snapshot reflects completeness.
    setShowProfileModal(false);
    if (location.pathname !== '/') navigate('/', { replace: true });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
        <Spinner size="lg" />
      </div>
    );
  }

  // Lock down the app until we have an authoritative profile snapshot.
  if (user && !profileLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
        <Spinner size="lg" />
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
      
      <main className="flex-grow relative flex flex-col">
        <ErrorBoundary>
            <Routes>
              <Route path="/" element={<LandingPage />} />
              {/* Phase-1 route aliases (no removals). Keep old paths working. */}
              <Route path="/home" element={<Navigate to="/" replace />} />
              <Route path="/planner" element={<Navigate to="/" replace />} />
              <Route path="/community" element={<Navigate to="/" replace />} />
              <Route path="/courses" element={<ResourcesPage />} />
              <Route path="/resources" element={<Navigate to="/courses" replace />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/profile" element={<ProfilePage />} />
              <Route path="/admin" element={isPublicBuild ? <NotFoundPage /> : <AdminDashboard />} />
              {/* Removed features */}
              <Route path="/study-groups" element={<NotFoundPage />} />
              <Route path="/calculator" element={<NotFoundPage />} />
              <Route path="/compiler" element={<NotFoundPage />} />
              <Route path="/events" element={<NotFoundPage />} />
              <Route path="/quiz" element={<NotFoundPage />} />
              <Route path="/exam-prep" element={<NotFoundPage />} />
              <Route path="/leaderboard" element={<NotFoundPage />} />
              <Route path="/analytics" element={<NotFoundPage />} />
              <Route path="/study-assistant" element={<NotFoundPage />} />
              <Route path="/study-plus" element={<NotFoundPage />} />
              <Route path="/todo" element={<NotFoundPage />} />
              <Route path="/insights" element={<NotFoundPage />} />
              <Route path="/developer" element={<NotFoundPage />} />
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
