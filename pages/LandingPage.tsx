import React from 'react';
import { motion, Variants } from 'framer-motion';
import { ArrowRight, Calculator, Camera, Library, Zap } from 'lucide-react';
import { Link } from 'react-router-dom';

const LandingPage: React.FC = () => {
  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.15,
        delayChildren: 0.2
      }
    }
  };

  const itemVariants: Variants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: {
        type: "spring",
        stiffness: 100,
        damping: 15
      }
    }
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-900/20 via-background to-background pt-20">
      {/* Hero Section */}
      <section className="relative px-4 pt-20 pb-16 mx-auto max-w-7xl sm:px-6 lg:px-8 lg:pt-32">
        <motion.div 
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="text-center"
        >
          <motion.div variants={itemVariants} className="inline-flex items-center px-4 py-1.5 mb-8 rounded-full bg-white/5 border border-white/10">
            <span className="flex h-2 w-2 rounded-full bg-secondary mr-2 animate-pulse"></span>
            <span className="text-sm font-medium text-gray-300">Updated for R25 Regulations</span>
          </motion.div>
          
          <motion.h1 variants={itemVariants} className="text-5xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white via-white to-gray-500 sm:text-7xl mb-6">
            TheCampus <br className="hidden sm:block" />
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-primary to-secondary">Helper</span>
          </motion.h1>
          
          <motion.p variants={itemVariants} className="max-w-2xl mx-auto text-xl text-gray-400 mb-10">
            One platform for all your academic needs. Lecture notes, previous year questions, and resources tailored for all branches.
          </motion.p>
          
          <motion.div variants={itemVariants} className="flex flex-col sm:flex-row justify-center gap-4">
            <Link 
              to="/resources"
              className="inline-flex items-center justify-center px-8 py-4 text-base font-medium text-white bg-primary rounded-lg hover:bg-primary/90 transition-all shadow-[0_0_20px_rgba(139,92,246,0.3)] hover:shadow-[0_0_30px_rgba(139,92,246,0.5)] group"
            >
              Explore Resources
              <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
            </Link>
            <Link 
              to="/login"
              className="inline-flex items-center justify-center px-8 py-4 text-base font-medium text-gray-300 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-all"
            >
              Student Login
            </Link>
          </motion.div>
        </motion.div>
      </section>

      {/* Features Grid */}
      <section className="py-24 relative overflow-hidden">
        {/* Background glow effects */}
        <div className="absolute top-1/2 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-[100px] -translate-y-1/2 -z-10"></div>
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-secondary/10 rounded-full blur-[100px] -z-10"></div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
            
            {/* Feature 1 */}
            <motion.div 
              whileHover={{ y: -5 }}
              className="relative p-8 bg-card border border-white/5 rounded-2xl hover:border-primary/50 transition-colors group"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl"></div>
              <div className="relative">
                <div className="w-12 h-12 flex items-center justify-center rounded-lg bg-primary/20 text-primary mb-6">
                  <Library className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold text-white mb-3">Curated Resources</h3>
                <p className="text-gray-400">Access verified notes, lab manuals, and previous question papers sorted by branch and semester.</p>
              </div>
            </motion.div>

            {/* Feature 2: CGPA Calculator */}
            <Link to="/calculator">
              <motion.div 
                whileHover={{ y: -5 }}
                className="relative p-8 bg-card border border-white/5 rounded-2xl hover:border-secondary/50 transition-colors group cursor-pointer h-full"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-secondary/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl"></div>
                <div className="relative">
                  <div className="w-12 h-12 flex items-center justify-center rounded-lg bg-secondary/20 text-secondary mb-6 group-hover:scale-110 transition-transform">
                    <Calculator className="w-6 h-6" />
                  </div>
                  <h3 className="text-xl font-bold text-white mb-3">CGPA Calculator</h3>
                  <p className="text-gray-400">Calculate your SGPA & CGPA easily with automatic JNTUH grade mapping and credit weightage.</p>
                </div>
              </motion.div>
            </Link>

            {/* Feature 3 */}
            <motion.div 
              whileHover={{ y: -5 }}
              className="relative p-8 bg-card border border-white/5 rounded-2xl hover:border-pink-500/50 transition-colors group"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-pink-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl"></div>
              <div className="relative">
                <div className="flex items-center justify-between mb-6">
                  <div className="w-12 h-12 flex items-center justify-center rounded-lg bg-pink-500/20 text-pink-500">
                    <Camera className="w-6 h-6" />
                  </div>
                  <span className="px-2 py-1 text-xs font-bold text-pink-500 bg-pink-500/10 rounded-full border border-pink-500/20">Coming Soon</span>
                </div>
                <h3 className="text-xl font-bold text-white mb-3">SnapLearn</h3>
                <p className="text-gray-400">Take a photo of any complex diagram or equation and get an instant AI-powered explanation.</p>
              </div>
            </motion.div>

          </div>
        </div>
      </section>
    </div>
  );
};

export default LandingPage;