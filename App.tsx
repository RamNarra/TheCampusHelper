import React, { useEffect, useState } from 'react';
import { HashRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import ProfilePage from './pages/ProfilePage';
import AdminDashboard from './pages/AdminDashboard';
import ResourcesPage from './pages/ResourcesPage';
import CalculatorPage from './pages/CalculatorPage';
import CompilerPage from './pages/CompilerPage';
import NotFoundPage from './pages/NotFoundPage';
import CompleteProfileModal from './components/CompleteProfileModal';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { Loader2 } from 'lucide-react';

// Google Analytics Measurement ID
const GA_MEASUREMENT_ID = 'G-K94JQ2GV7G'; 

interface ErrorBoundaryProps {
  children?: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

// --- Error Boundary Component ---
class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-zinc-950 text-white p-6 text-center">
          <div className="max-w-md">
            <h1 className="text-2xl font-bold text-red-500 mb-4">Something went wrong</h1>
            <p className="text-zinc-400 mb-6">The application encountered an unexpected error.</p>
            <pre className="bg-black/50 p-4 rounded text-left text-xs text-red-300 overflow-auto mb-6 border border-red-500/20">
              {this.state.error?.toString()}
            </pre>
            <button 
              onClick={() => window.location.reload()}
              className="px-6 py-2 bg-white text-black rounded font-bold hover:bg-gray-200"
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

// --- Helper Components ---

const Analytics = () => {
  const location = useLocation();
  useEffect(() => {
    if (GA_MEASUREMENT_ID) {
      console.log(`Analytics: Page View ${location.pathname}`);
    }
    window.scrollTo(0, 0);
  }, [location]);
  return null;
};

// --- Main App Content ---

const AppContent: React.FC = () => {
  const { user, loading } = useAuth();
  const [showProfileModal, setShowProfileModal] = useState(false);

  useEffect(() => {
    if (!loading && user) {
      const isProfileIncomplete = !user.branch || !user.year || !user.dateOfBirth;
      setShowProfileModal(isProfileIncomplete);
    } else {
      setShowProfileModal(false);
    }
  }, [user, loading]);

  // Global Loading State
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
      <CompleteProfileModal isOpen={showProfileModal} />
      
      <main className="flex-grow relative">
        <ErrorBoundary>
            <Routes>
              <Route path="/" element={<LandingPage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/profile" element={<ProfilePage />} />
              <Route path="/admin" element={<AdminDashboard />} />
              <Route path="/resources" element={<ResourcesPage />} />
              <Route path="/calculator" element={<CalculatorPage />} />
              <Route path="/compiler" element={<CompilerPage />} />
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
        {/* Using HashRouter to guarantee routing works without server config */}
        <Router>
          <AppContent />
        </Router>
      </ThemeProvider>
    </AuthProvider>
  );
};

export default App;