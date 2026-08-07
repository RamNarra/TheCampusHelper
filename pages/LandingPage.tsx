import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Search, ArrowRight, BookOpen, Calculator, Brain, Sparkles, FileText, CheckCircle2 } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

const LandingPage: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const navigate = useNavigate();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/courses?q=${encodeURIComponent(searchQuery.trim())}`);
    } else {
      navigate('/courses');
    }
  };

  return (
    <div className="bg-background min-h-[calc(100vh-4rem)] transition-colors duration-300 relative overflow-hidden">
      {/* Dynamic Background Glow */}
      <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[450px] bg-gradient-to-b from-primary/10 via-secondary/5 to-transparent blur-3xl opacity-70" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 pb-20">
        {/* Main Hero Header */}
        <div className="text-center max-w-3xl mx-auto mb-10">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 mb-6 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-semibold uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5" />
            <span>SNIST Academic Companion • R25 Regulation</span>
          </div>

          <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-foreground mb-4 leading-tight">
            Survive & Excel at <br />
            <span className="bg-gradient-to-r from-primary via-secondary to-primary bg-clip-text text-transparent">
              The Campus Helper
            </span>
          </h1>

          <p className="text-lg sm:text-xl text-muted-foreground leading-relaxed">
            Find lecture notes, previous year question papers, and mid-exam materials in seconds.
          </p>
        </div>

        {/* 5-Second Search Bar */}
        <form onSubmit={handleSearch} className="max-w-2xl mx-auto mb-8">
          <div className="relative flex items-center">
            <Search className="absolute left-4 w-5 h-5 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search subject notes, MID papers, or PYQs (e.g. Data Structures, BEE)..."
              className="w-full pl-12 pr-28 py-4 bg-card border border-border rounded-2xl text-foreground placeholder:text-muted-foreground/60 shadow-lg focus:outline-none focus:ring-2 focus:ring-primary/50 text-base sm:text-lg transition-all"
            />
            <button
              type="submit"
              className="absolute right-2 px-5 py-2.5 bg-primary text-primary-foreground font-semibold rounded-xl hover:bg-primary/90 transition-all text-sm shadow-md"
            >
              Search
            </button>
          </div>
        </form>

        {/* Quick Semester Chips */}
        <div className="flex flex-wrap items-center justify-center gap-2 mb-16">
          <span className="text-xs font-medium text-muted-foreground mr-1">Quick Select:</span>
          {['Sem 1', 'Sem 2', 'CSE', 'ECE', 'AIML', 'DS', 'IT'].map((chip) => (
            <Link
              key={chip}
              to={`/courses`}
              className="px-3.5 py-1.5 rounded-full bg-muted/60 hover:bg-primary/10 border border-border text-xs font-medium text-foreground transition-all hover:text-primary"
            >
              {chip}
            </Link>
          ))}
        </div>

        {/* Core 4 Pillar Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <motion.div whileHover={{ y: -4 }} className="h-full">
            <Link
              to="/courses"
              className="flex flex-col h-full p-6 bg-card border border-border rounded-2xl shadow-sm hover:shadow-xl hover:border-primary/40 transition-all group"
            >
              <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <BookOpen className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-foreground mb-2 flex items-center justify-between">
                Study Resources
                <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:translate-x-1 transition-transform" />
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed flex-1">
                Verified lecture PPTs, MID question papers, PYQs, and lab manuals organized by branch & semester.
              </p>
            </Link>
          </motion.div>

          <motion.div whileHover={{ y: -4 }} className="h-full">
            <Link
              to="/calculator"
              className="flex flex-col h-full p-6 bg-card border border-border rounded-2xl shadow-sm hover:shadow-xl hover:border-secondary/40 transition-all group"
            >
              <div className="w-12 h-12 rounded-xl bg-secondary/10 text-secondary flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <Calculator className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-foreground mb-2 flex items-center justify-between">
                CGPA Calculator
                <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:translate-x-1 transition-transform" />
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed flex-1">
                Compute SGPA and overall CGPA using exact JNTUH credit weightage & grade point rules.
              </p>
            </Link>
          </motion.div>

          <motion.div whileHover={{ y: -4 }} className="h-full">
            <Link
              to="/study-assistant"
              className="flex flex-col h-full p-6 bg-card border border-border rounded-2xl shadow-sm hover:shadow-xl hover:border-primary/40 transition-all group"
            >
              <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <Brain className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-foreground mb-2 flex items-center justify-between">
                AI Study Assistant
                <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:translate-x-1 transition-transform" />
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed flex-1">
                Ask doubts on syllabus topics, get step-by-step math explanations, and exam preparation tips.
              </p>
            </Link>
          </motion.div>

          <motion.div whileHover={{ y: -4 }} className="h-full">
            <Link
              to="/quiz"
              className="flex flex-col h-full p-6 bg-card border border-border rounded-2xl shadow-sm hover:shadow-xl hover:border-secondary/40 transition-all group"
            >
              <div className="w-12 h-12 rounded-xl bg-secondary/10 text-secondary flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <Sparkles className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-foreground mb-2 flex items-center justify-between">
                AI Quiz Generator
                <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:translate-x-1 transition-transform" />
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed flex-1">
                Generate topic-wise MCQ practice tests with instant detailed explanations for wrong answers.
              </p>
            </Link>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default LandingPage;
