
import React, { useEffect } from 'react';
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
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { AnimatePresence } from 'framer-motion';

// Google Analytics Measurement ID from Firebase config
const GA_MEASUREMENT_ID = 'G-K94JQ2GV7G'; 

const Analytics = () => {
  const location = useLocation();

  useEffect(() => {
    if (GA_MEASUREMENT_ID) {
      // Basic logging for now, can be replaced with actual gtag calls if script is loaded
      console.log(`Analytics: Page View ${location.pathname}`);
    }
    // Scroll to top on route change
    window.scrollTo(0, 0);
  }, [location]);

  return null;
};

const App: React.FC = () => {
  return (
    <AuthProvider>
      <ThemeProvider>
        <Router>
          <div className="min-h-screen flex flex-col bg-background text-foreground font-sans selection:bg-primary/30 transition-colors duration-300">
            <Analytics />
            <Navbar />
            <main className="flex-grow">
              <AnimatePresence mode="wait">
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
              </AnimatePresence>
            </main>
            <Footer />
          </div>
        </Router>
      </ThemeProvider>
    </AuthProvider>
  );
};

export default App;
