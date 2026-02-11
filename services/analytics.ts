import { LearningAnalytics, StudySession, QuizResult, ResourceType } from '../types';

// Mock data generator for demonstration purposes
// In a real app, this would fetch from Firestore

export const generateMockStudySessions = (userId: string): StudySession[] => {
  if ((import.meta as any).env?.PROD) return [];
  const subjects = [
    'Matrices and Calculus',
    'Engineering Physics',
    'Data Structures',
    'Programming for Problem Solving',
    'Database Management Systems'
  ];
  
  const resourceTypes: ResourceType[] = ['PPT', 'PYQ', 'MidPaper', 'ImpQ'];
  const sessions: StudySession[] = [];
  
  // Generate last 30 days of data
  for (let i = 0; i < 30; i++) {
    const numSessions = Math.floor(Math.random() * 3) + 1;
    for (let j = 0; j < numSessions; j++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      date.setHours(8 + Math.floor(Math.random() * 12));
      
      sessions.push({
        id: `session-${i}-${j}`,
        userId,
        subject: subjects[Math.floor(Math.random() * subjects.length)],
        resourceType: resourceTypes[Math.floor(Math.random() * resourceTypes.length)],
        duration: Math.floor(Math.random() * 90) + 15, // 15-105 minutes
        timestamp: date,
        completed: Math.random() > 0.2
      });
    }
  }
  
  return sessions.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
};

export const generateMockQuizResults = (userId: string): QuizResult[] => {
  if ((import.meta as any).env?.PROD) return [];
  const topics = [
    'Matrices',
    'Differential Calculus',
    'Data Structures',
    'Algorithms',
    'Database Normalization',
    'SQL Queries'
  ];
  
  const results: QuizResult[] = [];
  
  // Generate quiz results over last 60 days
  for (let i = 0; i < 15; i++) {
    const date = new Date();
    date.setDate(date.getDate() - (i * 4));
    
    const totalQuestions = Math.floor(Math.random() * 10) + 10;
    const correctAnswers = Math.floor(Math.random() * totalQuestions * 0.5) + Math.floor(totalQuestions * 0.3);
    
    results.push({
      id: `quiz-${i}`,
      userId,
      topic: topics[Math.floor(Math.random() * topics.length)],
      score: Math.round((correctAnswers / totalQuestions) * 100),
      timestamp: date,
      totalQuestions,
      correctAnswers
    });
  }
  
  return results.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
};

export const calculateAnalytics = (
  sessions: StudySession[],
  quizResults: QuizResult[]
): LearningAnalytics => {
  // Calculate daily study time (last 7 days)
  const daily: number[] = [];
  for (let i = 6; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    date.setHours(0, 0, 0, 0);
    
    const dayEnd = new Date(date);
    dayEnd.setHours(23, 59, 59, 999);
    
    const dayMinutes = sessions
      .filter(s => {
        const sessionDate = new Date(s.timestamp);
        return sessionDate >= date && sessionDate <= dayEnd;
      })
      .reduce((sum, s) => sum + s.duration, 0);
    
    daily.push(dayMinutes);
  }
  
  // Calculate weekly study time (last 4 weeks)
  const weekly: number[] = [];
  for (let i = 3; i >= 0; i--) {
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - (i * 7 + 6));
    weekStart.setHours(0, 0, 0, 0);
    
    const weekEnd = new Date();
    weekEnd.setDate(weekEnd.getDate() - (i * 7));
    weekEnd.setHours(23, 59, 59, 999);
    
    const weekMinutes = sessions
      .filter(s => {
        const sessionDate = new Date(s.timestamp);
        return sessionDate >= weekStart && sessionDate <= weekEnd;
      })
      .reduce((sum, s) => sum + s.duration, 0);
    
    weekly.push(weekMinutes);
  }
  
  // Calculate study time by subject
  const bySubjectObj: { [key: string]: number } = {};
  sessions.forEach(s => {
    bySubjectObj[s.subject] = (bySubjectObj[s.subject] || 0) + s.duration;
  });
  const bySubject = bySubjectObj;
  
  // Calculate quiz scores
  const quizScores = quizResults.map(q => q.score);
  
  // Calculate improvement rate
  const improvementRate = quizResults.length >= 2
    ? ((quizResults[quizResults.length - 1].score - quizResults[0].score) / quizResults[0].score) * 100
    : 0;
  
  // Identify strong and weak topics
  const topicScores: { [key: string]: number[] } = {};
  quizResults.forEach(q => {
    if (!topicScores[q.topic]) topicScores[q.topic] = [];
    topicScores[q.topic].push(q.score);
  });
  
  const topicAverages = Object.entries(topicScores).map(([topic, scores]) => ({
    topic,
    avg: scores.reduce((a, b) => a + b, 0) / scores.length
  }));
  
  const strongTopics = topicAverages
    .filter(t => t.avg >= 75)
    .sort((a, b) => b.avg - a.avg)
    .slice(0, 3)
    .map(t => t.topic);
  
  const weakTopics = topicAverages
    .filter(t => t.avg < 60)
    .sort((a, b) => a.avg - b.avg)
    .slice(0, 3)
    .map(t => t.topic);
  
  // Calculate most active time
  const hourCounts: { [key: number]: number } = {};
  sessions.forEach(s => {
    const hour = new Date(s.timestamp).getHours();
    hourCounts[hour] = (hourCounts[hour] || 0) + 1;
  });
  
  const mostActiveHour = Object.entries(hourCounts)
    .sort((a, b) => b[1] - a[1])[0]?.[0] || '9';
  
  const formatHour = (hour: string) => {
    const h = parseInt(hour);
    if (h === 0) return '12 AM';
    if (h < 12) return `${h} AM`;
    if (h === 12) return '12 PM';
    return `${h - 12} PM`;
  };
  
  const mostActiveTime = `${formatHour(mostActiveHour)} - ${formatHour((parseInt(mostActiveHour) + 1).toString())}`;
  
  // Calculate preferred resource types
  const resourceTypeCounts: { [key: string]: number } = {};
  sessions.forEach(s => {
    resourceTypeCounts[s.resourceType] = (resourceTypeCounts[s.resourceType] || 0) + 1;
  });
  
  const preferredResourceTypes = Object.entries(resourceTypeCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([type]) => type as ResourceType);
  
  // Calculate average session length
  const averageSessionLength = sessions.length > 0
    ? Math.round(sessions.reduce((sum, s) => sum + s.duration, 0) / sessions.length)
    : 0;
  
  // Calculate exam readiness (based on recent performance and study time)
  const recentQuizAvg = quizResults.slice(-5).reduce((sum, q) => sum + q.score, 0) / 
    Math.max(quizResults.slice(-5).length, 1);
  const recentStudyTime = daily.reduce((a, b) => a + b, 0);
  const targetStudyTime = 7 * 120; // 2 hours per day
  const studyTimeRatio = Math.min(recentStudyTime / targetStudyTime, 1);
  
  const examReadiness = Math.round((recentQuizAvg * 0.6 + studyTimeRatio * 100 * 0.4));
  
  // Recommended focus areas
  const recommendedFocusAreas = [
    ...weakTopics,
    ...Object.entries(bySubjectObj)
      .sort((a, b) => a[1] - b[1])
      .slice(0, 2)
      .map(([subject]) => subject)
  ].slice(0, 3);
  
  return {
    studyTime: {
      daily,
      weekly,
      bySubject
    },
    performance: {
      quizScores,
      improvementRate,
      strongTopics,
      weakTopics
    },
    habits: {
      mostActiveTime,
      preferredResourceTypes,
      averageSessionLength
    },
    predictions: {
      examReadiness,
      recommendedFocusAreas
    }
  };
};

export const getAnalyticsForUser = (userId: string): LearningAnalytics => {
  const sessions = generateMockStudySessions(userId);
  const quizResults = generateMockQuizResults(userId);
  return calculateAnalytics(sessions, quizResults);
};
