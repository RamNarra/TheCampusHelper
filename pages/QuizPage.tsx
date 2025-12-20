import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import { 
  Brain, 
  Loader2, 
  CheckCircle2, 
  XCircle, 
  RotateCcw, 
  Trophy,
  Clock,
  Target,
  BookOpen,
  Zap,
  LogIn
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/firebase';
import { QuizQuestion } from '../types';
import AdUnit from '../components/AdUnit';
import { isAuthBypassed } from '../lib/dev';

const QuizPage: React.FC = () => {
  const { user } = useAuth();
  const isPreview = !user && isAuthBypassed();
  const [subject, setSubject] = useState('');
  const [topic, setTopic] = useState('');
  const [difficulty, setDifficulty] = useState<number>(2); // 1=easy, 2=medium, 3=hard
  const [questionCount, setQuestionCount] = useState<number>(10);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState('');
  
  // Quiz state
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<{ [key: string]: string }>({});
  const [showResults, setShowResults] = useState(false);
  const [quizStartTime, setQuizStartTime] = useState<number>(0);
  const [timeSpent, setTimeSpent] = useState<number>(0);

  const currentQuestion = questions[currentQuestionIndex];
  const isQuizActive = questions.length > 0 && !showResults;

  // Popular subjects for quick selection
  const popularSubjects = [
    'Data Structures',
    'Operating Systems',
    'Database Management Systems',
    'Computer Networks',
    'Software Engineering',
    'Web Development',
    'Machine Learning',
    'Artificial Intelligence'
  ];

  const handleGenerateQuiz = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!subject.trim() || !topic.trim()) {
      setError('Please enter both subject and topic');
      return;
    }

    setIsGenerating(true);
    setError('');

    try {
      const response = await api.generateQuiz(subject, topic, difficulty, questionCount);
      
      // Transform questions to include unique IDs
      const transformedQuestions: QuizQuestion[] = response.questions.map((q: any, idx: number) => ({
        id: `q${idx + 1}`,
        question: q.question,
        options: q.options,
        correctAnswer: q.correctAnswer,
        explanation: q.explanation,
        difficulty: ['easy', 'medium', 'hard'][difficulty - 1] as 'easy' | 'medium' | 'hard'
      }));

      setQuestions(transformedQuestions);
      setCurrentQuestionIndex(0);
      setSelectedAnswers({});
      setShowResults(false);
      setQuizStartTime(Date.now());
    } catch (err: any) {
      setError(err.message || 'Failed to generate quiz. Please try again.');
      console.error('Quiz generation error:', err);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleAnswerSelect = (questionId: string, answerId: string) => {
    setSelectedAnswers(prev => ({
      ...prev,
      [questionId]: answerId
    }));
  };

  const handleNext = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
    } else {
      handleFinishQuiz();
    }
  };

  const handlePrevious = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(prev => prev - 1);
    }
  };

  const handleFinishQuiz = async () => {
    const endTime = Date.now();
    const totalTimeSpent = Math.floor((endTime - quizStartTime) / 1000);
    setTimeSpent(totalTimeSpent);
    setShowResults(true);

    // Calculate score
    const score = calculateScore();

    // Save attempt to Firebase if user is logged in
    if (user) {
      try {
        // Generate a unique quiz ID using crypto
        const quizId = crypto.randomUUID();
        
        await api.saveQuizAttempt({
          quizId,
          userId: user.uid,
          answers: selectedAnswers,
          score,
          totalQuestions: questions.length,
          timeSpent: totalTimeSpent,
          completedAt: null // Will be set by serverTimestamp
        });
      } catch (err) {
        console.error('Failed to save quiz attempt:', err);
      }
    }
  };

  const calculateScore = () => {
    let correct = 0;
    questions.forEach(q => {
      if (selectedAnswers[q.id] === q.correctAnswer) {
        correct++;
      }
    });
    return Math.round((correct / questions.length) * 100);
  };

  const handleRestart = () => {
    setQuestions([]);
    setCurrentQuestionIndex(0);
    setSelectedAnswers({});
    setShowResults(false);
    setSubject('');
    setTopic('');
    setError('');
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-primary';
    if (score >= 60) return 'text-secondary';
    return 'text-destructive';
  };

  // Show login prompt if user is not authenticated (unless preview bypass is enabled)
  if (!user && !isPreview) {
    return (
      <div className="flex-1 bg-background pt-6 pb-10 transition-colors duration-300">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center justify-center p-3 bg-primary/10 rounded-2xl mb-4">
            <Brain className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold text-foreground mb-4">
            AI Quizzes
          </h1>
          <p className="text-xl text-muted-foreground mb-8">
            Generate focused MCQ quizzes and track attempts.
          </p>
          
          <div className="bg-card border border-border rounded-2xl p-8 shadow-sm">
            <LogIn className="w-16 h-16 text-primary mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-foreground mb-4">Login Required</h2>
            <p className="text-muted-foreground mb-6">
              Please sign in to access AI-generated quizzes and track your progress.
            </p>
            <Link
              to="/login"
              className="inline-flex items-center justify-center px-8 py-4 text-base font-semibold text-primary-foreground bg-primary rounded-xl hover:bg-primary/90 transition-colors shadow-sm"
            >
              <LogIn className="w-5 h-5 mr-2" />
              Sign In to Continue
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 bg-background pt-6 pb-10 transition-colors duration-300">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center p-3 bg-primary/10 rounded-2xl mb-4">
            <Brain className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold text-foreground mb-4">
            AI Quizzes
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Generate MCQs with explanations, then review answers and performance.
          </p>
          {isPreview && (
            <div className="mt-5 inline-flex items-center justify-center rounded-full border border-border bg-muted/40 px-4 py-2 text-sm text-muted-foreground">
              Preview mode is enabled. Sign in to save attempts.
            </div>
          )}
        </div>

        {/* Ad Unit */}
        <div className="mb-8">
          <AdUnit />
        </div>

          {/* Main Content */}
          {!isQuizActive && !showResults && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="max-w-2xl mx-auto"
            >
              <div className="bg-card border border-border rounded-2xl shadow-sm p-8">
                <h2 className="text-2xl font-bold text-foreground mb-6">Generate Your Quiz</h2>
                
                <form onSubmit={handleGenerateQuiz} className="space-y-6">
                  {/* Subject Input */}
                  <div>
                    <label className="block text-sm font-semibold text-foreground mb-2">
                      Subject
                    </label>
                    <input
                      type="text"
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      placeholder="e.g., Data Structures, Operating Systems"
                      className="w-full px-4 py-3 bg-background border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent transition-all text-foreground placeholder:text-muted-foreground"
                      required
                    />
                    
                    {/* Quick Select Subjects */}
                    <div className="mt-3 flex flex-wrap gap-2">
                      {popularSubjects.map((subj) => (
                        <button
                          key={subj}
                          type="button"
                          onClick={() => setSubject(subj)}
                          className="px-3 py-1.5 text-xs font-medium bg-muted hover:bg-primary/10 text-muted-foreground hover:text-primary rounded-full transition-colors border border-border"
                        >
                          {subj}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Topic Input */}
                  <div>
                    <label className="block text-sm font-semibold text-foreground mb-2">
                      Topic
                    </label>
                    <input
                      type="text"
                      value={topic}
                      onChange={(e) => setTopic(e.target.value)}
                      placeholder="e.g., Binary Trees, Process Scheduling"
                      className="w-full px-4 py-3 bg-background border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent transition-all text-foreground placeholder:text-muted-foreground"
                      required
                    />
                  </div>

                  {/* Difficulty Selector */}
                  <div>
                    <label className="block text-sm font-semibold text-foreground mb-3">
                      Difficulty Level
                    </label>
                    <div className="grid grid-cols-3 gap-3">
                      {[
                        { value: 1, label: 'Easy' },
                        { value: 2, label: 'Medium' },
                        { value: 3, label: 'Hard' }
                      ].map((level) => (
                        <button
                          key={level.value}
                          type="button"
                          onClick={() => setDifficulty(level.value)}
                          className={`px-4 py-3 rounded-lg font-semibold transition-all border-2 ${
                            difficulty === level.value
                              ? 'bg-primary/10 border-primary text-primary'
                              : 'bg-background border-border text-muted-foreground hover:border-primary/50'
                          }`}
                        >
                          {level.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Question Count */}
                  <div>
                    <label className="block text-sm font-semibold text-foreground mb-2">
                      Number of Questions: {questionCount}
                    </label>
                    <input
                      type="range"
                      min="5"
                      max="20"
                      value={questionCount}
                      onChange={(e) => setQuestionCount(parseInt(e.target.value))}
                      className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
                    />
                    <div className="flex justify-between text-xs text-muted-foreground mt-1">
                      <span>5 questions</span>
                      <span>20 questions</span>
                    </div>
                  </div>

                  {/* Error Message */}
                  {error && (
                    <div className="p-4 bg-destructive/10 border border-destructive/30 rounded-lg">
                      <p className="text-destructive text-sm">{error}</p>
                    </div>
                  )}

                  {/* Submit Button */}
                  <button
                    type="submit"
                    disabled={isGenerating}
                    className="w-full bg-primary text-primary-foreground py-4 rounded-xl font-semibold text-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm flex items-center justify-center gap-2"
                  >
                    {isGenerating ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Generating Quiz...
                      </>
                    ) : (
                      <>
                        <Zap className="w-5 h-5" />
                        Generate Quiz
                      </>
                    )}
                  </button>
                </form>
              </div>

              {/* Info Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
                <div className="bg-card border border-border rounded-xl p-4 text-center">
                  <Target className="w-6 h-6 text-primary mx-auto mb-2" />
                  <div className="text-sm font-semibold text-foreground">Adaptive</div>
                  <div className="text-xs text-muted-foreground mt-1">Difficulty adjusts to your level</div>
                </div>
                <div className="bg-card border border-border rounded-xl p-4 text-center">
                  <BookOpen className="w-6 h-6 text-primary mx-auto mb-2" />
                  <div className="text-sm font-semibold text-foreground">Explanations</div>
                  <div className="text-xs text-muted-foreground mt-1">Learn from detailed answers</div>
                </div>
                <div className="bg-card border border-border rounded-xl p-4 text-center">
                  <Trophy className="w-6 h-6 text-primary mx-auto mb-2" />
                  <div className="text-sm font-semibold text-foreground">Track Progress</div>
                  <div className="text-xs text-muted-foreground mt-1">Monitor your performance</div>
                </div>
              </div>
            </motion.div>
          )}

          {/* Quiz Interface */}
          {isQuizActive && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="max-w-4xl mx-auto"
            >
              {/* Progress Bar */}
              <div className="mb-8">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-semibold text-muted-foreground">
                    Question {currentQuestionIndex + 1} of {questions.length}
                  </span>
                  <span className="text-sm font-semibold text-muted-foreground">
                    {Object.keys(selectedAnswers).length} answered
                  </span>
                </div>
                <div className="w-full bg-muted rounded-full h-2">
                  <div
                    className="bg-primary h-2 rounded-full transition-all duration-300"
                    style={{ width: `${((currentQuestionIndex + 1) / questions.length) * 100}%` }}
                  />
                </div>
              </div>

              {/* Question Card */}
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentQuestionIndex}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="bg-card border border-border rounded-2xl shadow-sm p-8 mb-6"
                >
                  <div className="flex items-start gap-4 mb-6">
                    <div className="flex-shrink-0 w-10 h-10 bg-primary/10 text-primary rounded-full flex items-center justify-center font-bold">
                      {currentQuestionIndex + 1}
                    </div>
                    <h3 className="text-xl font-bold text-foreground flex-1">
                      {currentQuestion.question}
                    </h3>
                  </div>

                  {/* Options */}
                  <div className="space-y-3">
                    {currentQuestion.options.map((option) => {
                      const isSelected = selectedAnswers[currentQuestion.id] === option.id;
                      
                      return (
                        <button
                          key={option.id}
                          onClick={() => handleAnswerSelect(currentQuestion.id, option.id)}
                          className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
                            isSelected
                              ? 'bg-primary/10 border-primary text-foreground'
                              : 'bg-background border-border text-muted-foreground hover:border-primary/50'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                              isSelected ? 'border-primary bg-primary text-primary-foreground' : 'border-border'
                            }`}>
                              {isSelected && <CheckCircle2 className="w-4 h-4" />}
                            </div>
                            <span className="font-medium">
                              <span className="font-bold mr-2">{option.id}.</span>
                              {option.text}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </motion.div>
              </AnimatePresence>

              {/* Navigation Buttons */}
              <div className="flex gap-4">
                <button
                  onClick={handlePrevious}
                  disabled={currentQuestionIndex === 0}
                  className="px-6 py-3 bg-muted text-foreground rounded-xl font-semibold hover:bg-muted/80 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  Previous
                </button>
                <button
                  onClick={handleNext}
                  disabled={!selectedAnswers[currentQuestion.id]}
                  className="flex-1 bg-primary text-primary-foreground py-3 rounded-xl font-semibold hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
                >
                  {currentQuestionIndex === questions.length - 1 ? 'Finish Quiz' : 'Next Question'}
                </button>
              </div>
            </motion.div>
          )}

          {/* Results Screen */}
          {showResults && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="max-w-4xl mx-auto"
            >
              {/* Score Card */}
              <div className="bg-card border border-border rounded-2xl shadow-sm p-8 mb-8 text-center">
                <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-2">Quiz complete</h2>
                <div className={`text-5xl sm:text-6xl font-bold ${getScoreColor(calculateScore())} mb-4`}>
                  {calculateScore()}%
                </div>
                <p className="text-xl text-muted-foreground mb-6">
                  You answered {questions.filter(q => selectedAnswers[q.id] === q.correctAnswer).length} out of {questions.length} correctly
                </p>
                
                {/* Stats */}
                <div className="grid grid-cols-2 gap-4 max-w-md mx-auto mb-6">
                  <div className="bg-background rounded-xl p-4">
                    <Clock className="w-6 h-6 text-primary mx-auto mb-2" />
                    <div className="text-sm text-muted-foreground">Time Spent</div>
                    <div className="text-lg font-bold text-foreground">
                      {Math.floor(timeSpent / 60)}:{(timeSpent % 60).toString().padStart(2, '0')}
                    </div>
                  </div>
                  <div className="bg-background rounded-xl p-4">
                    <Target className="w-6 h-6 text-primary mx-auto mb-2" />
                    <div className="text-sm text-muted-foreground">Accuracy</div>
                    <div className="text-lg font-bold text-foreground">
                      {calculateScore()}%
                    </div>
                  </div>
                </div>

                <button
                  onClick={handleRestart}
                  className="px-8 py-3 bg-primary text-primary-foreground rounded-xl font-semibold hover:bg-primary/90 transition-colors shadow-sm inline-flex items-center gap-2"
                >
                  <RotateCcw className="w-5 h-5" />
                  Take Another Quiz
                </button>
              </div>

              {/* Detailed Results */}
              <div className="space-y-4">
                <h3 className="text-2xl font-bold text-foreground mb-4">Review Answers</h3>
                
                {questions.map((question, idx) => {
                  const userAnswer = selectedAnswers[question.id];
                  const isCorrect = userAnswer === question.correctAnswer;
                  
                  return (
                    <div
                      key={question.id}
                      className={`bg-card border rounded-xl p-6 ${isCorrect ? 'border-primary/30' : 'border-destructive/30'}`}
                    >
                      <div className="flex items-start gap-3 mb-4">
                        {isCorrect ? (
                          <CheckCircle2 className="w-6 h-6 text-primary flex-shrink-0 mt-1" />
                        ) : (
                          <XCircle className="w-6 h-6 text-destructive flex-shrink-0 mt-1" />
                        )}
                        <div className="flex-1">
                          <h4 className="font-bold text-foreground mb-3">
                            {idx + 1}. {question.question}
                          </h4>
                          
                          {/* Show user's answer if wrong */}
                          {!isCorrect && userAnswer && (
                            <div className="mb-2 p-3 bg-destructive/10 rounded-lg border border-destructive/30">
                              <span className="text-destructive font-semibold">Your answer: </span>
                              <span className="text-foreground">
                                {question.options.find(o => o.id === userAnswer)?.text}
                              </span>
                            </div>
                          )}
                          
                          {/* Show correct answer */}
                          <div className="mb-3 p-3 bg-primary/10 rounded-lg border border-primary/20">
                            <span className="text-primary font-semibold">Correct answer: </span>
                            <span className="text-foreground">
                              {question.options.find(o => o.id === question.correctAnswer)?.text}
                            </span>
                          </div>
                          
                          {/* Explanation */}
                          <div className="p-3 bg-primary/5 rounded-lg">
                            <span className="text-primary font-semibold">Explanation: </span>
                            <span className="text-muted-foreground">{question.explanation}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}
      </div>
    </div>
  );
};

export default QuizPage;
