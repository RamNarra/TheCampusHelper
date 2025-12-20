
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { Menu, X, BookOpen, LayoutDashboard, User, LogIn, Sparkles, Calculator, Terminal, Sun, Moon, Trophy, Users, BarChart3, Brain, Calendar, ChevronDown } from 'lucide-react';
import { cn } from '../lib/utils';
import { AnimatePresence, motion } from 'framer-motion';
import { isAtLeastRole, normalizeRole } from '../lib/rbac';

const Navbar: React.FC = () => {
  const { user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const [isStudyOpen, setIsStudyOpen] = useState(false);
  const studyMenuRef = useRef<HTMLDivElement | null>(null);

  const toggleMenu = () => setIsOpen(!isOpen);

  const isStaff = isAtLeastRole(normalizeRole(user?.role), 'moderator');

  const primaryLinks = useMemo(() => {
    return [
      { name: 'Home', path: '/', icon: null },
      { name: 'Resources', path: '/resources', icon: <BookOpen className="w-4 h-4 mr-2" /> },
      ...(user ? [{ name: 'To-Do', path: '/todo', icon: <Calendar className="w-4 h-4 mr-2" /> }] : []),
      { name: 'Leaderboard', path: '/leaderboard', icon: <Trophy className="w-4 h-4 mr-2" /> },
      { name: 'Developer', path: '/developer', icon: <User className="w-4 h-4 mr-2" /> },
      ...(isStaff ? [{ name: 'Admin', path: '/admin', icon: <LayoutDashboard className="w-4 h-4 mr-2" /> }] : []),
    ];
  }, [isStaff, user]);

  const studyLinks = useMemo(() => {
    return [
      { name: 'Study+', path: '/study-plus', icon: <Sparkles className="w-4 h-4 mr-2" /> },
      { name: 'Study Assistant', path: '/study-assistant', icon: <Brain className="w-4 h-4 mr-2" /> },
      { name: 'Quiz', path: '/quiz', icon: <Brain className="w-4 h-4 mr-2" /> },
      { name: 'Exam Prep', path: '/exam-prep', icon: <Brain className="w-4 h-4 mr-2" /> },
      { name: 'Study Groups', path: '/study-groups', icon: <Users className="w-4 h-4 mr-2" /> },
      { name: 'Calculator', path: '/calculator', icon: <Calculator className="w-4 h-4 mr-2" /> },
      { name: 'Compiler', path: '/compiler', icon: <Terminal className="w-4 h-4 mr-2" /> },
      { name: 'Events', path: '/events', icon: <Calendar className="w-4 h-4 mr-2" /> },
      ...(user ? [{ name: 'Analytics', path: '/analytics', icon: <BarChart3 className="w-4 h-4 mr-2" /> }] : []),
    ];
  }, [user]);

  useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      if (!isStudyOpen) return;
      const el = studyMenuRef.current;
      if (!el) return;
      if (e.target instanceof Node && !el.contains(e.target)) {
        setIsStudyOpen(false);
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [isStudyOpen]);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border bg-background/80 backdrop-blur-md supports-[backdrop-filter]:bg-background/80 transition-colors duration-300">
      <div className="w-full px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <NavLink to="/" className="flex items-center gap-2 group">
            <div className="bg-primary/10 p-1.5 rounded-lg group-hover:bg-primary/20 transition-colors duration-300">
              <Sparkles className="w-5 h-5 text-primary" />
            </div>
            <span className="text-xl font-bold tracking-tight text-foreground">
              TheCampus<span className="text-primary font-normal">Helper</span>
            </span>
          </NavLink>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-2">
            {primaryLinks.map((link) => (
              <NavLink
                key={link.path}
                to={link.path}
                className={({ isActive }) =>
                  cn(
                    "flex items-center px-3 py-2 text-sm font-medium transition-all duration-200 rounded-lg",
                    isActive
                      ? "text-primary bg-primary/10"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  )
                }
              >
                {link.icon}
                {link.name}
              </NavLink>
            ))}

            {/* Study+ Dropdown */}
            <div ref={studyMenuRef} className="relative">
              <button
                type="button"
                onClick={() => setIsStudyOpen((v) => !v)}
                className={cn(
                  "flex items-center px-3 py-2 text-sm font-medium transition-all duration-200 rounded-lg",
                  "text-muted-foreground hover:text-foreground hover:bg-muted"
                )}
                aria-haspopup="menu"
                aria-expanded={isStudyOpen}
              >
                Study+
                <ChevronDown className={cn("w-4 h-4 ml-1 transition-transform", isStudyOpen ? "rotate-180" : "rotate-0")} />
              </button>

              <AnimatePresence>
                {isStudyOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 6 }}
                    transition={{ duration: 0.15 }}
                    className="absolute right-0 mt-2 w-56 bg-background border border-border rounded-xl shadow-lg overflow-hidden"
                    role="menu"
                  >
                    <div className="p-2 space-y-1">
                      {studyLinks.map((link) => (
                        <NavLink
                          key={link.path}
                          to={link.path}
                          onClick={() => setIsStudyOpen(false)}
                          className={({ isActive }) =>
                            cn(
                              "flex items-center px-3 py-2 text-sm font-medium transition-colors rounded-lg",
                              isActive
                                ? "text-primary bg-primary/10"
                                : "text-muted-foreground hover:text-foreground hover:bg-muted"
                            )
                          }
                          role="menuitem"
                        >
                          {link.icon}
                          {link.name}
                        </NavLink>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="flex items-center gap-3 ml-2 pl-2 border-l border-border">
              {/* Theme Toggle */}
              <button 
                onClick={toggleTheme}
                className="p-2 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
              >
                {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </button>

              {user ? (
                <NavLink to="/profile" className="flex items-center gap-2 group ml-2">
                  <div className="w-8 h-8 rounded-full overflow-hidden border-2 border-transparent group-hover:border-primary transition-all ring-2 ring-transparent group-hover:ring-primary/20">
                    <img 
                      src={user.photoURL || `https://ui-avatars.com/api/?name=${user.displayName}`} 
                      alt="Profile" 
                      className="w-full h-full object-cover"
                    />
                  </div>
                </NavLink>
              ) : (
                <NavLink
                  to="/login"
                  className="ml-2 px-4 py-2 text-sm font-semibold text-white bg-primary hover:bg-primary/90 rounded-full transition-all shadow-sm hover:shadow-md"
                >
                  Sign In
                </NavLink>
              )}
            </div>
          </div>

          {/* Mobile Menu Button & Theme Toggle */}
          <div className="flex items-center gap-4 md:hidden">
            <button 
                onClick={toggleTheme}
                className="p-2 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
            <button
              onClick={toggleMenu}
              className="text-muted-foreground hover:text-foreground focus:outline-none p-1"
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
            className="md:hidden bg-background border-b border-border overflow-hidden"
          >
            <div className="px-4 pt-2 pb-4 space-y-2">
              {primaryLinks.map((link) => (
                <NavLink
                  key={link.path}
                  to={link.path}
                  onClick={() => setIsOpen(false)}
                  className={({ isActive }) =>
                    cn(
                      "flex items-center px-4 py-3 rounded-lg text-base font-medium transition-colors",
                      isActive
                        ? "text-primary bg-primary/10"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted"
                    )
                  }
                >
                  {link.icon}
                  {link.name}
                </NavLink>
              ))}

              <div className="pt-2 mt-2 border-t border-border">
                <div className="px-4 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Study+
                </div>
                {studyLinks.map((link) => (
                  <NavLink
                    key={link.path}
                    to={link.path}
                    onClick={() => setIsOpen(false)}
                    className={({ isActive }) =>
                      cn(
                        "flex items-center px-4 py-3 rounded-lg text-base font-medium transition-colors",
                        isActive
                          ? "text-primary bg-primary/10"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted"
                      )
                    }
                  >
                    {link.icon}
                    {link.name}
                  </NavLink>
                ))}
              </div>

              {user ? (
                 <NavLink
                  to="/profile"
                  onClick={() => setIsOpen(false)}
                  className={({ isActive }) =>
                    cn(
                      "flex items-center px-4 py-3 rounded-lg text-base font-medium transition-colors",
                      isActive
                        ? "text-primary bg-primary/10"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted"
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
                  className="flex items-center px-4 py-3 rounded-lg text-base font-medium text-white bg-primary hover:bg-primary/90 mt-4 justify-center shadow-sm"
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
