import React, { useEffect } from 'react';
import { HashRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import Navbar from './components/Navbar';
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import ProfilePage from './pages/ProfilePage';
import AdminDashboard from './pages/AdminDashboard';
import ResourcesPage from './pages/ResourcesPage';
import { AuthProvider } from './context/AuthContext';
import { AnimatePresence } from 'framer-motion';

// Google Analytics Setup
const GA_MEASUREMENT_ID = ''; // Leave empty for now
const Analytics = () => {
  const location = useLocation();

  useEffect(() => {
    if (GA_MEASUREMENT_ID) {
      console.log(`GA Pageview: ${location.pathname}`);
      // window.gtag('config', GA_MEASUREMENT_ID, { page_path: location.pathname });
    }
  }, [location]);

  return null;
};

const App: React.FC = () => {
  return (
    <AuthProvider>
      <Router>
        <div className="min-h-screen bg-background text-foreground font-sans selection:bg-primary/30">
          <Analytics />
          <Navbar />
          <AnimatePresence mode="wait">
            <Routes>
              <Route path="/" element={<LandingPage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/profile" element={<ProfilePage />} />
              <Route path="/admin" element={<AdminDashboard />} />
              <Route path="/resources" element={<ResourcesPage />} />
            </Routes>
          </AnimatePresence>
        </div>
      </Router>
    </AuthProvider>
  );
};

export default App;