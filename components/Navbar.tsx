import React, { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Menu, X, BookOpen, LayoutDashboard, User, LogIn, Sparkles } from 'lucide-react';
import { cn } from '../lib/utils';
import { AnimatePresence, motion } from 'framer-motion';

const Navbar: React.FC = () => {
  const { user, logout } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();

  const toggleMenu = () => setIsOpen(!isOpen);

  const navLinks = [
    { name: 'Home', path: '/', icon: null },
    { name: 'Resources', path: '/resources', icon: <BookOpen className="w-4 h-4 mr-2" /> },
    ...(user?.role === 'admin' ? [{ name: 'Admin', path: '/admin', icon: <LayoutDashboard className="w-4 h-4 mr-2" /> }] : []),
  ];

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-white/10 bg-background/60 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <NavLink to="/" className="flex items-center gap-2 group">
            <div className="bg-gradient-to-tr from-primary to-secondary p-1.5 rounded-lg group-hover:shadow-[0_0_20px_rgba(139,92,246,0.5)] transition-shadow duration-300">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">
              TheCampus<span className="text-primary font-normal">Helper</span>
            </span>
          </NavLink>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-6">
            {navLinks.map((link) => (
              <NavLink
                key={link.path}
                to={link.path}
                className={({ isActive }) =>
                  cn(
                    "flex items-center px-3 py-2 text-sm font-medium transition-colors duration-200 rounded-md",
                    isActive
                      ? "text-white bg-white/10"
                      : "text-gray-400 hover:text-white hover:bg-white/5"
                  )
                }
              >
                {link.icon}
                {link.name}
              </NavLink>
            ))}

            {user ? (
              <div className="flex items-center gap-4 ml-4 pl-4 border-l border-white/10">
                <NavLink to="/profile" className="flex items-center gap-2 group">
                  <div className="w-8 h-8 rounded-full overflow-hidden border-2 border-transparent group-hover:border-primary transition-all">
                    <img 
                      src={user.photoURL || `https://ui-avatars.com/api/?name=${user.displayName}`} 
                      alt="Profile" 
                      className="w-full h-full object-cover"
                    />
                  </div>
                </NavLink>
              </div>
            ) : (
              <NavLink
                to="/login"
                className="ml-4 px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-full transition-all shadow-[0_0_15px_rgba(139,92,246,0.3)] hover:shadow-[0_0_25px_rgba(139,92,246,0.5)]"
              >
                Sign In
              </NavLink>
            )}
          </div>

          {/* Mobile Menu Button */}
          <div className="flex md:hidden">
            <button
              onClick={toggleMenu}
              className="text-gray-400 hover:text-white focus:outline-none"
            >
              {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden bg-background/95 border-b border-white/10 overflow-hidden"
          >
            <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3">
              {navLinks.map((link) => (
                <NavLink
                  key={link.path}
                  to={link.path}
                  onClick={() => setIsOpen(false)}
                  className={({ isActive }) =>
                    cn(
                      "flex items-center px-3 py-2 rounded-md text-base font-medium",
                      isActive
                        ? "text-white bg-white/10"
                        : "text-gray-400 hover:text-white hover:bg-white/5"
                    )
                  }
                >
                  {link.icon}
                  {link.name}
                </NavLink>
              ))}
              {user ? (
                 <NavLink
                  to="/profile"
                  onClick={() => setIsOpen(false)}
                  className={({ isActive }) =>
                    cn(
                      "flex items-center px-3 py-2 rounded-md text-base font-medium",
                      isActive
                        ? "text-white bg-white/10"
                        : "text-gray-400 hover:text-white hover:bg-white/5"
                    )
                  }
                >
                  <User className="w-4 h-4 mr-2"/>
                  Profile
                </NavLink>
              ) : (
                <NavLink
                  to="/login"
                  onClick={() => setIsOpen(false)}
                  className="flex items-center px-3 py-2 rounded-md text-base font-medium text-primary hover:text-primary/90"
                >
                  <LogIn className="w-4 h-4 mr-2"/>
                  Sign In
                </NavLink>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
};

export default Navbar;