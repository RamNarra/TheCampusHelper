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
import NotFoundPage from './pages/NotFoundPage';
import { AuthProvider } from './context/AuthContext';
import { AnimatePresence } from 'framer-motion';

// Google Analytics Setup (Placeholder)
const GA_MEASUREMENT_ID = ''; 
const Analytics = () => {
  const location = useLocation();

  useEffect(() => {
    if (GA_MEASUREMENT_ID) {
      console.log(`GA Pageview: ${location.pathname}`);
      // window.gtag('config', GA_MEASUREMENT_ID, { page_path: location.pathname });
    }
    // Scroll to top on route change
    window.scrollTo(0, 0);
  }, [location]);

  return null;
};

const App: React.FC = () => {
  return (
    <AuthProvider>
      <Router>
        <div className="min-h-screen flex flex-col bg-background text-foreground font-sans selection:bg-primary/30">
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
                <Route path="*" element={<NotFoundPage />} />
              </Routes>
            </AnimatePresence>
          </main>
          {/* Footer is rendered outside Routes so it appears on all pages, 
              but we might want to hide it on specific layout-heavy pages if needed. 
              For now, showing everywhere. */}
          <Footer />
        </div>
      </Router>
    </AuthProvider>
  );
};

export default App;