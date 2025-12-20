
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
import { isAuthBypassed } from '../lib/dev';

const ExamPrepPage: React.FC = () => {
  const { user } = useAuth();
  const isPreview = !user && isAuthBypassed();
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
      case 'high': return 'text-destructive';
      case 'medium': return 'text-secondary';
      case 'low': return 'text-primary';
      default: return 'text-muted-foreground';
    }
  };

  const getReadinessColor = (readiness: number) => {
    if (readiness >= 75) return 'text-primary';
    if (readiness >= 50) return 'text-secondary';
    return 'text-destructive';
  };

  if (!user && !isPreview) return <Navigate to="/login" replace />;

  return (
    <div className="pt-6 pb-10 px-4 max-w-7xl mx-auto sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-10">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-3xl sm:text-4xl font-bold text-foreground flex items-center gap-3">
            <Brain className="w-10 h-10 text-primary" />
            Exam Preparation
          </h1>
          <button
            disabled
            className="flex items-center gap-2 px-4 py-2 bg-primary/50 text-primary-foreground rounded-lg cursor-not-allowed transition-all font-medium"
            title="Coming soon"
          >
            <Plus className="w-5 h-5" />
            Add Exam
          </button>
        </div>
        <p className="text-muted-foreground text-lg">
          A calm dashboard for plans, progress, and priorities.
        </p>
        {isPreview && (
          <div className="mt-4 rounded-xl border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
            Preview mode is enabled. Sign in to save your exam plan in the future.
          </div>
        )}
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
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'bg-card text-muted-foreground hover:text-foreground hover:bg-card/80 border border-border'
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
              className="bg-card border border-border p-6 rounded-2xl"
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
                        <div className="text-xl font-bold text-foreground">Completed</div>
                        <div className="text-sm text-muted-foreground">Exam date has passed</div>
                      </>
                    ) : (
                      <>
                        <div className="text-3xl font-bold text-foreground">{days}</div>
                        <div className="text-sm text-muted-foreground">days</div>
                        <div className="text-xs text-muted-foreground">{hours}h {minutes}m</div>
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
                <span className="text-sm font-medium text-muted-foreground">Readiness</span>
              </div>
              <div className={`text-3xl font-bold ${getReadinessColor(selectedExam.progress.predictedReadiness)}`}>
                {selectedExam.progress.predictedReadiness}%
              </div>
              <div className="text-xs text-muted-foreground mt-1">Predicted score range</div>
            </motion.div>

            {/* Completed Tasks */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-card border border-border p-6 rounded-2xl"
            >
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle2 className="w-5 h-5 text-primary" />
                <span className="text-sm font-medium text-muted-foreground">Completed</span>
              </div>
              <div className="text-3xl font-bold text-foreground">
                {selectedExam.progress.completed}
              </div>
              <div className="text-xs text-muted-foreground mt-1">
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
                <Heart className="w-5 h-5 text-primary" />
                <span className="text-sm font-medium text-muted-foreground">Stress Level</span>
              </div>
              <div className={`text-3xl font-bold capitalize ${getStressColor(selectedExam.stressLevel)}`}>
                {selectedExam.stressLevel || 'Low'}
              </div>
              <div className="text-xs text-muted-foreground mt-1">Wellness check</div>
            </motion.div>
          </div>

          {/* Subject Progress */}
          <div className="bg-card border border-border rounded-2xl p-6">
            <h2 className="text-xl font-bold text-foreground mb-4 flex items-center gap-2">
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
                        <span className="text-foreground font-medium">{subject.name}</span>
                        <span className="text-sm text-muted-foreground ml-2">
                          {subject.completedTopics}/{subject.totalTopics} topics
                        </span>
                      </div>
                      <span className="text-sm font-medium text-primary">
                        {Math.round(progress)}%
                      </span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-2">
                      <div
                        className="bg-primary h-2 rounded-full transition-all duration-300"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                    {subject.weakTopics.length > 0 && (
                      <div className="flex items-start gap-2 text-sm">
                        <AlertCircle className="w-4 h-4 text-secondary mt-0.5 flex-shrink-0" />
                        <div>
                          <span className="text-muted-foreground">Weak Topics: </span>
                          <span className="text-secondary">{subject.weakTopics.join(', ')}</span>
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
              <h2 className="text-xl font-bold text-foreground mb-4 flex items-center gap-2">
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
                      high: 'border-destructive/30 bg-destructive/10',
                      medium: 'border-secondary/30 bg-secondary/10',
                      low: 'border-primary/30 bg-primary/10'
                    };

                    return (
                      <div
                        key={task.id}
                        className={`flex items-center gap-3 p-3 rounded-lg border ${
                          task.completed
                            ? 'bg-muted/40 border-border'
                            : priorityColors[task.priority]
                        } transition-all`}
                      >
                        <button
                          onClick={() => toggleTaskCompletion(task.id)}
                          aria-label={`Mark ${task.topic} as ${task.completed ? 'incomplete' : 'complete'}`}
                          className={`flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                            task.completed
                              ? 'bg-primary border-primary'
                              : 'border-border hover:border-primary'
                          }`}
                        >
                          {task.completed && <CheckCircle2 className="w-4 h-4 text-primary-foreground" />}
                        </button>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className={`font-medium ${task.completed ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                              {task.topic}
                            </span>
                            {isToday && (
                              <span className="text-xs bg-primary px-2 py-0.5 rounded-full text-primary-foreground font-medium">
                                Today
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
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
              <h2 className="text-xl font-bold text-foreground mb-4 flex items-center gap-2">
                <Target className="w-6 h-6 text-secondary" />
                Recommendations
              </h2>
              <div className="space-y-3">
                {getMockTestRecommendations(selectedExam.subjects).map((rec, idx) => (
                  <div
                    key={idx}
                    className="p-3 bg-secondary/10 border border-secondary/20 rounded-lg"
                  >
                    <p className="text-sm text-muted-foreground">{rec}</p>
                  </div>
                ))}
                {selectedExam.stressLevel === 'high' && (
                  <div className="p-3 bg-destructive/10 border border-destructive/30 rounded-lg">
                    <div className="flex items-start gap-2">
                      <Heart className="w-4 h-4 text-destructive mt-0.5 flex-shrink-0" />
                      <div className="text-sm text-muted-foreground">
                        <p className="font-medium text-destructive mb-1">High stress detected</p>
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
          <Brain className="w-20 h-20 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-xl font-bold text-foreground mb-2">No Exams Added</h3>
          <p className="text-muted-foreground mb-6">Add an exam to begin tracking.</p>
          <button
            disabled
            className="px-6 py-3 bg-primary/50 text-primary-foreground rounded-lg cursor-not-allowed transition-all font-medium"
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
