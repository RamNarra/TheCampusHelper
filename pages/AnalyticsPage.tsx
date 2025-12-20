import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Navigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  TrendingUp,
  Clock,
  BookOpen,
  Award,
  Target,
  Brain,
  BarChart3,
  Calendar,
  Zap,
  AlertCircle
} from 'lucide-react';
import { LearningAnalytics } from '../types';
import { getAnalyticsForUser } from '../services/analytics';
import { getPreviewUserId, isAuthBypassed } from '../lib/dev';

const AnalyticsPage: React.FC = () => {
  const { user } = useAuth();
  const [analytics, setAnalytics] = useState<LearningAnalytics | null>(null);
  const isPreview = !user && isAuthBypassed();
  const effectiveUserId = user?.uid ?? (isPreview ? getPreviewUserId() : null);

  useEffect(() => {
    if (!effectiveUserId) return;
    const data = getAnalyticsForUser(effectiveUserId);
    setAnalytics(data);
  }, [effectiveUserId]);

  if (!user && !isPreview) return <Navigate to="/login" replace />;

  if (!analytics) {
    return (
      <div className="flex-1 flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  const getDayLabel = (index: number) => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const date = new Date();
    date.setDate(date.getDate() - (6 - index));
    return days[date.getDay()];
  };

  const getWeekLabel = (index: number) => {
    return `Week ${4 - index}`;
  };

  const maxDaily = Math.max(...analytics.studyTime.daily, 1);
  const maxWeekly = Math.max(...analytics.studyTime.weekly, 1);

  const getReadinessColor = (score: number) => {
    if (score >= 80) return 'text-primary';
    if (score >= 60) return 'text-secondary';
    return 'text-destructive';
  };

  const getReadinessLabel = (score: number) => {
    if (score >= 80) return 'Excellent';
    if (score >= 60) return 'Good';
    return 'Needs Work';
  };

  return (
    <div className="pt-6 pb-10 px-4 max-w-7xl mx-auto sm:px-6 lg:px-8">
      {/* Header */}
      <motion.div
        initial={{ y: 10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="mb-8"
      >
        <h1 className="text-4xl font-bold text-foreground mb-2 flex items-center gap-3">
          <BarChart3 className="w-10 h-10 text-primary" />
          Learning Analytics
        </h1>
        <p className="text-muted-foreground">
          Track your study patterns, performance, and get personalized insights
        </p>
        {isPreview && (
          <div className="mt-4 rounded-xl border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
            Preview mode is enabled. Analytics shown are mock data.
          </div>
        )}
      </motion.div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <motion.div
          initial={{ y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="bg-card border border-border rounded-xl p-6 shadow-sm"
        >
          <div className="flex items-center justify-between mb-2">
            <Clock className="w-8 h-8 text-primary" />
            <span className="text-xs font-medium text-muted-foreground">This Week</span>
          </div>
          <h3 className="text-3xl font-bold text-foreground mb-1">
            {Math.round(analytics.studyTime.daily.reduce((a, b) => a + b, 0) / 60)}h
          </h3>
          <p className="text-sm text-muted-foreground">Study Time</p>
        </motion.div>

        <motion.div
          initial={{ y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.15 }}
          className="bg-card border border-border rounded-xl p-6 shadow-sm"
        >
          <div className="flex items-center justify-between mb-2">
            <Award className="w-8 h-8 text-secondary" />
            <span className="text-xs font-medium text-muted-foreground">Average</span>
          </div>
          <h3 className="text-3xl font-bold text-foreground mb-1">
            {analytics.performance.quizScores.length > 0
              ? Math.round(
                  analytics.performance.quizScores.reduce((a, b) => a + b, 0) /
                    analytics.performance.quizScores.length
                )
              : 0}
            %
          </h3>
          <p className="text-sm text-muted-foreground">Quiz Score</p>
        </motion.div>

        <motion.div
          initial={{ y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="bg-card border border-border rounded-xl p-6 shadow-sm"
        >
          <div className="flex items-center justify-between mb-2">
            <TrendingUp className="w-8 h-8 text-primary" />
            <span className="text-xs font-medium text-muted-foreground">Progress</span>
          </div>
          <h3 className="text-3xl font-bold text-foreground mb-1">
            {analytics.performance.improvementRate > 0 ? '+' : ''}
            {Math.round(analytics.performance.improvementRate)}%
          </h3>
          <p className="text-sm text-muted-foreground">Improvement</p>
        </motion.div>

        <motion.div
          initial={{ y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.25 }}
          className="bg-card border border-border rounded-xl p-6 shadow-sm"
        >
          <div className="flex items-center justify-between mb-2">
            <Zap className="w-8 h-8 text-secondary" />
            <span className="text-xs font-medium text-muted-foreground">Sessions</span>
          </div>
          <h3 className="text-3xl font-bold text-foreground mb-1">
            {analytics.habits.averageSessionLength}
          </h3>
          <p className="text-sm text-muted-foreground">Avg Minutes</p>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        {/* Daily Study Time Heatmap */}
        <motion.div
          initial={{ y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="bg-card border border-border rounded-xl p-6 shadow-sm"
        >
          <div className="flex items-center gap-2 mb-6">
            <Calendar className="w-5 h-5 text-primary" />
            <h2 className="text-xl font-bold text-foreground">Daily Study Time</h2>
          </div>
          <div className="space-y-3">
            {analytics.studyTime.daily.map((minutes, index) => (
              <div key={index} className="flex items-center gap-3">
                <span className="text-sm font-medium text-muted-foreground w-10">
                  {getDayLabel(index)}
                </span>
                <div className="flex-1 bg-muted rounded-full h-8 overflow-hidden relative">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${(minutes / maxDaily) * 100}%` }}
                    transition={{ delay: 0.4 + index * 0.05, duration: 0.5 }}
                    className="h-full bg-gradient-to-r from-primary to-primary/70 flex items-center justify-end pr-3"
                  >
                    {minutes > 0 && (
                      <span className="text-xs font-semibold text-primary-foreground">
                        {Math.round(minutes)}m
                      </span>
                    )}
                  </motion.div>
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Weekly Study Time */}
        <motion.div
          initial={{ y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.35 }}
          className="bg-card border border-border rounded-xl p-6 shadow-sm"
        >
          <div className="flex items-center gap-2 mb-6">
            <BarChart3 className="w-5 h-5 text-secondary" />
            <h2 className="text-xl font-bold text-foreground">Weekly Trend</h2>
          </div>
          <div className="space-y-3">
            {analytics.studyTime.weekly.map((minutes, index) => (
              <div key={index} className="flex items-center gap-3">
                <span className="text-sm font-medium text-muted-foreground w-16">
                  {getWeekLabel(index)}
                </span>
                <div className="flex-1 bg-muted rounded-full h-8 overflow-hidden relative">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${(minutes / maxWeekly) * 100}%` }}
                    transition={{ delay: 0.4 + index * 0.05, duration: 0.5 }}
                    className="h-full bg-gradient-to-r from-secondary to-secondary/70 flex items-center justify-end pr-3"
                  >
                    {minutes > 0 && (
                      <span className="text-xs font-semibold text-primary-foreground">
                        {Math.round(minutes / 60)}h
                      </span>
                    )}
                  </motion.div>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Study Time by Subject */}
      <motion.div
        initial={{ y: 10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="bg-card border border-border rounded-xl p-6 shadow-sm mb-8"
      >
        <div className="flex items-center gap-2 mb-6">
          <BookOpen className="w-5 h-5 text-primary" />
          <h2 className="text-xl font-bold text-foreground">Study Time by Subject</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {(Object.entries(analytics.studyTime.bySubject) as Array<[string, number]>)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 6)
            .map(([subject, minutes]) => (
              <div
                key={subject}
                className="bg-muted/50 rounded-lg p-4 border border-border/50"
              >
                <h3 className="text-sm font-semibold text-foreground mb-2 line-clamp-1">
                  {subject}
                </h3>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-primary">
                    {Math.round(minutes / 60)}
                  </span>
                  <span className="text-sm text-muted-foreground">hours</span>
                </div>
              </div>
            ))}
        </div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        {/* Performance & Topics */}
        <motion.div
          initial={{ y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.45 }}
          className="bg-card border border-border rounded-xl p-6 shadow-sm"
        >
          <div className="flex items-center gap-2 mb-6">
            <Award className="w-5 h-5 text-secondary" />
            <h2 className="text-xl font-bold text-foreground">Performance Analysis</h2>
          </div>

          <div className="space-y-6">
            {/* Strong Topics */}
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-primary" />
                Strong Topics
              </h3>
              <div className="space-y-2">
                {analytics.performance.strongTopics.length > 0 ? (
                  analytics.performance.strongTopics.map((topic) => (
                    <div
                      key={topic}
                      className="bg-primary/10 border border-primary/20 rounded-lg px-3 py-2 text-sm text-foreground"
                    >
                      {topic}
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Complete more quizzes to see your strong topics
                  </p>
                )}
              </div>
            </div>

            {/* Weak Topics */}
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-destructive" />
                Areas for Improvement
              </h3>
              <div className="space-y-2">
                {analytics.performance.weakTopics.length > 0 ? (
                  analytics.performance.weakTopics.map((topic) => (
                    <div
                      key={topic}
                      className="bg-destructive/10 border border-destructive/30 rounded-lg px-3 py-2 text-sm text-foreground"
                    >
                      {topic}
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Great! No weak areas identified yet
                  </p>
                )}
              </div>
            </div>
          </div>
        </motion.div>

        {/* Study Habits */}
        <motion.div
          initial={{ y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="bg-card border border-border rounded-xl p-6 shadow-sm"
        >
          <div className="flex items-center gap-2 mb-6">
            <Brain className="w-5 h-5 text-primary" />
            <h2 className="text-xl font-bold text-foreground">Study Habits</h2>
          </div>

          <div className="space-y-6">
            {/* Most Active Time */}
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground mb-2">
                Most Active Time
              </h3>
              <div className="bg-primary/10 border border-primary/20 rounded-lg px-4 py-3">
                <p className="text-lg font-bold text-primary">
                  {analytics.habits.mostActiveTime}
                </p>
              </div>
            </div>

            {/* Preferred Resources */}
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground mb-3">
                Preferred Resource Types
              </h3>
              <div className="flex flex-wrap gap-2">
                {analytics.habits.preferredResourceTypes.map((type) => (
                  <span
                    key={type}
                    className="px-3 py-1.5 bg-secondary/10 border border-secondary/20 rounded-full text-sm font-medium text-secondary"
                  >
                    {type}
                  </span>
                ))}
              </div>
            </div>

            {/* Average Session */}
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground mb-2">
                Average Session Length
              </h3>
              <div className="bg-muted/50 rounded-lg px-4 py-3 border border-border/50">
                <p className="text-lg font-bold text-foreground">
                  {analytics.habits.averageSessionLength} minutes
                </p>
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Exam Readiness & Recommendations */}
      <motion.div
        initial={{ y: 10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.55 }}
        className="bg-gradient-to-br from-primary/10 to-secondary/10 border border-primary/20 rounded-xl p-8 shadow-sm"
      >
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-4">
              <Target className="w-6 h-6 text-primary" />
              <h2 className="text-2xl font-bold text-foreground">Exam Readiness</h2>
            </div>
            <div className="flex items-baseline gap-3 mb-2">
              <span
                className={`text-5xl font-bold ${getReadinessColor(
                  analytics.predictions.examReadiness
                )}`}
              >
                {analytics.predictions.examReadiness}%
              </span>
              <span className="text-lg text-muted-foreground">
                {getReadinessLabel(analytics.predictions.examReadiness)}
              </span>
            </div>
            <p className="text-sm text-muted-foreground max-w-md">
              Based on your recent performance and study patterns, here's your predicted exam
              readiness score.
            </p>
          </div>

          <div className="flex-1">
            <h3 className="text-sm font-semibold text-foreground mb-3">
              Recommended Focus Areas
            </h3>
            <div className="space-y-2">
              {analytics.predictions.recommendedFocusAreas.map((area, index) => (
                <div
                  key={index}
                  className="flex items-center gap-3 bg-background/80 border border-border rounded-lg px-4 py-3"
                >
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center">
                    {index + 1}
                  </span>
                  <span className="text-sm font-medium text-foreground">{area}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default AnalyticsPage;
