
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Navigate } from 'react-router-dom';
import { 
  Calendar, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  TrendingUp, 
  Brain,
  BookOpen,
  Target,
  Heart,
  Plus
} from 'lucide-react';
import { ExamPrep } from '../types';
import { 
  generateStudySchedule, 
  calculateReadiness, 
  getMockTestRecommendations,
  calculateStressLevel 
} from '../lib/data';
import AdUnit from '../components/AdUnit';
import { useAuth } from '../context/AuthContext';

const ExamPrepPage: React.FC = () => {
  const { user } = useAuth();
  const [exams, setExams] = useState<ExamPrep[]>([]);
  const [selectedExam, setSelectedExam] = useState<ExamPrep | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Update countdown timer every minute
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000); // Update every minute

    return () => clearInterval(timer);
  }, []);

  // Initialize with sample data
  useEffect(() => {
    const sampleExams: ExamPrep[] = [
      {
        id: 'exam-1',
        examName: 'Mid-Term Examination',
        examDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days from now
        subjects: [
          {
            id: 'subj-1',
            name: 'Data Structures',
            totalTopics: 10,
            completedTopics: 6,
            weakTopics: ['Graphs', 'Dynamic Programming'],
            lastStudied: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
          },
          {
            id: 'subj-2',
            name: 'Operating Systems',
            totalTopics: 8,
            completedTopics: 4,
            weakTopics: ['Deadlock', 'Memory Management'],
            lastStudied: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000)
          },
          {
            id: 'subj-3',
            name: 'Database Management Systems',
            totalTopics: 12,
            completedTopics: 8,
            weakTopics: ['Normalization'],
            lastStudied: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)
          }
        ],
        studyPlan: [],
        progress: {
          completed: 0,
          remaining: 0,
          predictedReadiness: 0
        }
      }
    ];

    // Generate study schedules immutably
    const initializedExams = sampleExams.map(exam => {
      const studyPlan = generateStudySchedule(exam.subjects, exam.examDate);
      const completed = studyPlan.filter(t => t.completed).length;
      return {
        ...exam,
        studyPlan,
        progress: {
          completed,
          remaining: studyPlan.length - completed,
          predictedReadiness: calculateReadiness({ ...exam, studyPlan })
        },
        stressLevel: calculateStressLevel({ ...exam, studyPlan })
      };
    });

    setExams(initializedExams);
    if (initializedExams.length > 0) {
      setSelectedExam(initializedExams[0]);
    }
  }, []);

  const toggleTaskCompletion = (taskId: string) => {
    if (!selectedExam) return;

    const updatedExam = {
      ...selectedExam,
      studyPlan: selectedExam.studyPlan.map(task =>
        task.id === taskId ? { ...task, completed: !task.completed } : task
      )
    };

    const completed = updatedExam.studyPlan.filter(t => t.completed).length;
    updatedExam.progress = {
      completed,
      remaining: updatedExam.studyPlan.length - completed,
      predictedReadiness: calculateReadiness(updatedExam)
    };
    updatedExam.stressLevel = calculateStressLevel(updatedExam);

    setSelectedExam(updatedExam);
    setExams(exams.map(e => e.id === updatedExam.id ? updatedExam : e));
  };

  const getCountdown = (examDate: Date) => {
    const date = examDate instanceof Date ? examDate : new Date(examDate);
    const diff = date.getTime() - currentTime.getTime();
    
    // Handle past exam dates
    if (diff < 0) {
      return { days: 0, hours: 0, minutes: 0, isPast: true };
    }
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    return { days, hours, minutes, isPast: false };
  };

  const getStressColor = (level?: 'low' | 'medium' | 'high') => {
    switch (level) {
      case 'high': return 'text-red-500';
      case 'medium': return 'text-yellow-500';
      case 'low': return 'text-green-500';
      default: return 'text-gray-500';
    }
  };

  const getReadinessColor = (readiness: number) => {
    if (readiness >= 75) return 'text-green-500';
    if (readiness >= 50) return 'text-yellow-500';
    return 'text-red-500';
  };

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="min-h-screen pt-24 pb-12 px-4 max-w-7xl mx-auto sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-10">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-3xl sm:text-4xl font-bold text-white flex items-center gap-3">
            <Brain className="w-10 h-10 text-primary" />
            Exam Preparation Dashboard
          </h1>
          <button
            disabled
            className="flex items-center gap-2 px-4 py-2 bg-primary/50 text-white rounded-lg cursor-not-allowed transition-all font-medium"
            title="Coming soon"
          >
            <Plus className="w-5 h-5" />
            Add Exam
          </button>
        </div>
        <p className="text-gray-400 text-lg">
          AI-powered tracking, personalized plans, and analytics for focused exam preparation.
        </p>
      </div>

      <AdUnit className="mb-8" />

      {/* Exam Selection Tabs */}
      {exams.length > 0 && (
        <div className="flex gap-2 mb-8 overflow-x-auto pb-2">
          {exams.map((exam) => {
            const countdown = getCountdown(exam.examDate);
            return (
              <button
                key={exam.id}
                onClick={() => setSelectedExam(exam)}
                className={`px-6 py-3 rounded-xl text-sm font-medium transition-all whitespace-nowrap ${
                  selectedExam?.id === exam.id
                    ? 'bg-primary text-white shadow-lg'
                    : 'bg-card text-gray-400 hover:text-white hover:bg-card/80 border border-border'
                }`}
              >
                <div className="flex flex-col items-start">
                  <span>{exam.examName}</span>
                  <span className="text-xs opacity-75">
                    {countdown.isPast ? 'Completed' : `${countdown.days}d ${countdown.hours}h`}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {selectedExam ? (
        <div className="space-y-6">
          {/* Countdown Timer & Key Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Countdown */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-gradient-to-br from-primary to-secondary p-6 rounded-2xl text-white"
            >
              <div className="flex items-center gap-2 mb-2">
                <Clock className="w-5 h-5" />
                <span className="text-sm font-medium">Time Remaining</span>
              </div>
              {(() => {
                const { days, hours, minutes, isPast } = getCountdown(selectedExam.examDate);
                return (
                  <div className="space-y-1">
                    {isPast ? (
                      <>
                        <div className="text-xl font-bold">Completed</div>
                        <div className="text-sm opacity-90">Exam has passed</div>
                      </>
                    ) : (
                      <>
                        <div className="text-3xl font-bold">{days}</div>
                        <div className="text-sm opacity-90">days</div>
                        <div className="text-xs opacity-75">{hours}h {minutes}m</div>
                      </>
                    )}
                  </div>
                );
              })()}
            </motion.div>

            {/* Predicted Readiness */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-card border border-border p-6 rounded-2xl"
            >
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="w-5 h-5 text-primary" />
                <span className="text-sm font-medium text-gray-300">Readiness</span>
              </div>
              <div className={`text-3xl font-bold ${getReadinessColor(selectedExam.progress.predictedReadiness)}`}>
                {selectedExam.progress.predictedReadiness}%
              </div>
              <div className="text-xs text-gray-500 mt-1">Predicted Score Range</div>
            </motion.div>

            {/* Completed Tasks */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-card border border-border p-6 rounded-2xl"
            >
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle2 className="w-5 h-5 text-green-500" />
                <span className="text-sm font-medium text-gray-300">Completed</span>
              </div>
              <div className="text-3xl font-bold text-white">
                {selectedExam.progress.completed}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                of {selectedExam.studyPlan.length} tasks
              </div>
            </motion.div>

            {/* Stress Level */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="bg-card border border-border p-6 rounded-2xl"
            >
              <div className="flex items-center gap-2 mb-2">
                <Heart className="w-5 h-5 text-pink-500" />
                <span className="text-sm font-medium text-gray-300">Stress Level</span>
              </div>
              <div className={`text-3xl font-bold capitalize ${getStressColor(selectedExam.stressLevel)}`}>
                {selectedExam.stressLevel || 'Low'}
              </div>
              <div className="text-xs text-gray-500 mt-1">Wellness Check</div>
            </motion.div>
          </div>

          {/* Subject Progress */}
          <div className="bg-card border border-border rounded-2xl p-6">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <BookOpen className="w-6 h-6 text-primary" />
              Subject Progress
            </h2>
            <div className="space-y-4">
              {selectedExam.subjects.map((subject) => {
                const progress = (subject.completedTopics / subject.totalTopics) * 100;
                return (
                  <div key={subject.id} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-white font-medium">{subject.name}</span>
                        <span className="text-sm text-gray-500 ml-2">
                          {subject.completedTopics}/{subject.totalTopics} topics
                        </span>
                      </div>
                      <span className="text-sm font-medium text-primary">
                        {Math.round(progress)}%
                      </span>
                    </div>
                    <div className="w-full bg-gray-800 rounded-full h-2">
                      <div
                        className="bg-primary h-2 rounded-full transition-all duration-300"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                    {subject.weakTopics.length > 0 && (
                      <div className="flex items-start gap-2 text-sm">
                        <AlertCircle className="w-4 h-4 text-yellow-500 mt-0.5 flex-shrink-0" />
                        <div>
                          <span className="text-gray-400">Weak Topics: </span>
                          <span className="text-yellow-500">{subject.weakTopics.join(', ')}</span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Study Schedule & Mock Tests */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Today's Tasks */}
            <div className="lg:col-span-2 bg-card border border-border rounded-2xl p-6">
              <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                <Calendar className="w-6 h-6 text-primary" />
                Study Schedule (Next 7 Days)
              </h2>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {selectedExam.studyPlan
                  .filter(task => {
                    const daysFromNow = Math.floor(
                      (new Date(task.scheduledDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
                    );
                    return daysFromNow >= 0 && daysFromNow <= 7;
                  })
                  .map((task) => {
                    const subject = selectedExam.subjects.find(s => s.id === task.subjectId);
                    const isToday = new Date(task.scheduledDate).toDateString() === new Date().toDateString();
                    const priorityColors = {
                      high: 'border-red-500 bg-red-500/10',
                      medium: 'border-yellow-500 bg-yellow-500/10',
                      low: 'border-green-500 bg-green-500/10'
                    };

                    return (
                      <div
                        key={task.id}
                        className={`flex items-center gap-3 p-3 rounded-lg border ${
                          task.completed
                            ? 'bg-green-500/5 border-green-500/20'
                            : priorityColors[task.priority]
                        } transition-all`}
                      >
                        <button
                          onClick={() => toggleTaskCompletion(task.id)}
                          aria-label={`Mark ${task.topic} as ${task.completed ? 'incomplete' : 'complete'}`}
                          className={`flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                            task.completed
                              ? 'bg-green-500 border-green-500'
                              : 'border-gray-600 hover:border-primary'
                          }`}
                        >
                          {task.completed && <CheckCircle2 className="w-4 h-4 text-white" />}
                        </button>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className={`font-medium ${task.completed ? 'line-through text-gray-500' : 'text-white'}`}>
                              {task.topic}
                            </span>
                            {isToday && (
                              <span className="text-xs bg-primary px-2 py-0.5 rounded-full text-white font-medium">
                                Today
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 text-xs text-gray-500 mt-1">
                            <span>{subject?.name}</span>
                            <span>•</span>
                            <span>{task.duration} min</span>
                            <span>•</span>
                            <span>{new Date(task.scheduledDate).toLocaleDateString()}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>

            {/* Mock Tests & Recommendations */}
            <div className="bg-card border border-border rounded-2xl p-6">
              <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                <Target className="w-6 h-6 text-secondary" />
                Recommendations
              </h2>
              <div className="space-y-3">
                {getMockTestRecommendations(selectedExam.subjects).map((rec, idx) => (
                  <div
                    key={idx}
                    className="p-3 bg-secondary/10 border border-secondary/20 rounded-lg"
                  >
                    <p className="text-sm text-gray-300">{rec}</p>
                  </div>
                ))}
                {selectedExam.stressLevel === 'high' && (
                  <div className="p-3 bg-pink-500/10 border border-pink-500/20 rounded-lg">
                    <div className="flex items-start gap-2">
                      <Heart className="w-4 h-4 text-pink-500 mt-0.5 flex-shrink-0" />
                      <div className="text-sm text-gray-300">
                        <p className="font-medium text-pink-500 mb-1">High Stress Detected</p>
                        <p className="text-xs">Take regular breaks, practice deep breathing, and maintain a healthy sleep schedule.</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="text-center py-20">
          <Brain className="w-20 h-20 text-gray-600 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-gray-300 mb-2">No Exams Added</h3>
          <p className="text-gray-500 mb-6">Start by adding your first exam to begin tracking.</p>
          <button
            disabled
            className="px-6 py-3 bg-primary/50 text-white rounded-lg cursor-not-allowed transition-all font-medium"
            title="Coming soon"
          >
            Add Your First Exam
          </button>
        </div>
      )}
    </div>
  );
};

export default ExamPrepPage;
