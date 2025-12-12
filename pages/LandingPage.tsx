
import React from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Calculator, Camera, Library, Brain } from 'lucide-react';
import { Link } from 'react-router-dom';
import AdUnit from '../components/AdUnit';

const LandingPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-background pt-24 transition-colors duration-300">
      {/* Ambient BG */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[600px] bg-gradient-to-b from-primary/5 to-transparent dark:from-primary/10"></div>
      </div>

      {/* Hero Section */}
      <section className="relative z-10 px-4 pt-12 pb-16 mx-auto max-w-7xl sm:px-6 lg:px-8 lg:pt-24 text-center">
        <div className="max-w-4xl mx-auto">
          <div className="inline-flex items-center px-4 py-1.5 mb-8 rounded-full bg-muted border border-border shadow-sm">
            <span className="flex h-2.5 w-2.5 rounded-full bg-secondary mr-2 animate-pulse"></span>
            <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Updated for R25 Regulations</span>
          </div>
          
          <h1 className="text-5xl font-extrabold tracking-tight text-foreground sm:text-7xl mb-6 leading-tight">
            TheCampus <br className="hidden sm:block" />
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-primary to-secondary">Helper</span>
          </h1>
          
          <p className="max-w-2xl mx-auto text-xl text-muted-foreground mb-10 leading-relaxed">
             One platform for all your academic needs. Lecture notes, previous year questions, and resources tailored for all branches.
          </p>
          
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <Link 
              to="/resources"
              className="inline-flex items-center justify-center px-8 py-4 text-base font-bold text-white bg-primary rounded-xl hover:bg-primary/90 transition-all shadow-lg shadow-primary/30 hover:shadow-primary/50 group"
            >
              Explore Resources
              <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
            </Link>
            <Link 
              to="/login"
              className="inline-flex items-center justify-center px-8 py-4 text-base font-bold text-foreground bg-card border border-border rounded-xl hover:bg-muted/50 transition-all shadow-sm hover:shadow-md"
            >
              Student Login
            </Link>
          </div>
        </div>
      </section>

      {/* Ad Unit */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-16 relative z-10">
        <AdUnit className="my-0" />
      </div>

      {/* Features Grid */}
      <section className="pb-24 relative z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            
            {/* Feature 1 */}
            <motion.div 
              whileHover={{ y: -8 }}
              className="relative p-8 bg-card border border-border rounded-2xl shadow-sm hover:shadow-xl transition-all group"
            >
              <div className="w-14 h-14 flex items-center justify-center rounded-2xl bg-primary/10 text-primary mb-6">
                <Library className="w-7 h-7" />
              </div>
              <h3 className="text-xl font-bold text-foreground mb-3">Curated Resources</h3>
              <p className="text-muted-foreground leading-relaxed">Access verified notes, lab manuals, and previous question papers sorted by branch and semester.</p>
            </motion.div>

            {/* Feature 2: CGPA Calculator */}
            <Link to="/calculator" className="block h-full">
              <motion.div 
                whileHover={{ y: -8 }}
                className="relative p-8 bg-card border border-border rounded-2xl shadow-sm hover:shadow-xl transition-all group h-full cursor-pointer"
              >
                <div className="w-14 h-14 flex items-center justify-center rounded-2xl bg-secondary/10 text-secondary mb-6 group-hover:scale-110 transition-transform">
                  <Calculator className="w-7 h-7" />
                </div>
                <h3 className="text-xl font-bold text-foreground mb-3">CGPA Calculator</h3>
                <p className="text-muted-foreground leading-relaxed">Calculate your SGPA & CGPA easily with automatic JNTUH grade mapping and credit weightage.</p>
              </motion.div>
            </Link>

            {/* Feature 3: Exam Prep Dashboard */}
            <Link to="/exam-prep" className="block h-full">
              <motion.div 
                whileHover={{ y: -8 }}
                className="relative p-8 bg-card border border-border rounded-2xl shadow-sm hover:shadow-xl transition-all group h-full cursor-pointer"
              >
                <div className="w-14 h-14 flex items-center justify-center rounded-2xl bg-primary/10 text-primary mb-6 group-hover:scale-110 transition-transform">
                  <Brain className="w-7 h-7" />
                </div>
                <h3 className="text-xl font-bold text-foreground mb-3">Smart Exam Prep</h3>
                <p className="text-muted-foreground leading-relaxed">AI-powered exam tracking with personalized study plans, progress analytics, and readiness predictions.</p>
              </motion.div>
            </Link>

          </div>
        </div>
      </section>
    </div>
  );
};

export default LandingPage;
