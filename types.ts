
export type ResourceType = 'Note' | 'PYQ' | 'Lab Record' | 'PPT' | 'MidPaper' | 'ImpQ';

export type UserRole = 'user' | 'mod' | 'admin';

export interface UserProfile {
  uid: string;
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
  role: UserRole;
  disabled?: boolean;
  branch?: 'CS_IT_DS' | 'AIML_ECE_CYS';
  year?: string;
  dateOfBirth?: string; // Format: YYYY-MM-DD
  profileCompleted?: boolean; // New flag to prevent infinite onboarding loops
  // Gamification fields
  xp?: number;
  level?: number;
  streak?: number;
  lastLoginDate?: string; // ISO date string
  achievementIds?: string[];
  studyPattern?: 'visual' | 'text' | 'mixed'; // Learning preference
}

export interface Resource {
  id: string;
  title: string;
  subject: string;
  branch: 'CS_IT_DS' | 'AIML_ECE_CYS';
  semester: string; // "1" through "8"
  unit?: string; // '1', '2', '3', '4', '5' (Optional, for unit-specific files)
  type: ResourceType;
  downloadUrl: string;
  driveFileId?: string; // New field for the Google Drive ID
  status?: 'approved' | 'pending' | 'rejected';
  ownerId?: string;
  reviewedBy?: string;
  reviewedAt?: any;
  rejectionReason?: string;
  createdAt?: any; // Firestore Timestamp
  updatedAt?: any; // Firestore Timestamp
}

export interface StatMetric {
  label: string;
  value: string;
  change?: string;
}

// Gamification types
export type BadgeType = 'bronze' | 'silver' | 'gold' | 'platinum' | 'special';
export type AchievementCategory = 'login' | 'resources' | 'contribution' | 'streak' | 'social';

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  category: AchievementCategory;
  xpReward: number;
  badgeType?: BadgeType;
  unlockedAt?: string; // ISO timestamp
}

export interface UserProgress {
  level: number;
  xp: number;
  achievements: Achievement[];
  streak: number;
  leaderboardRank?: number;
  nextLevelXp: number;
}

export interface LeaderboardEntry {
  uid: string;
  displayName: string | null;
  photoURL: string | null;
  xp: number;
  level: number;
  rank: number;
}

export interface DailyChallenge {
  id: string;
  title: string;
  description: string;
  xpReward: number;
  completed?: boolean;
  expiresAt: string; // ISO timestamp
}

// Exam Preparation Dashboard Types
export interface Subject {
  id: string;
  name: string;
  totalTopics: number;
  completedTopics: number;
  weakTopics: string[];
  lastStudied?: Date;
}

export interface StudyTask {
  id: string;
  subjectId: string;
  topic: string;
  scheduledDate: string; // ISO 8601 format, e.g. "2024-06-01T12:00:00Z"
  completed: boolean;
  duration: number; // in minutes
  priority: 'high' | 'medium' | 'low';
}

export interface ExamPrep {
  id: string;
  examName: string;
  examDate: Date;
  subjects: Subject[];
  studyPlan: StudyTask[];
  progress: {
    completed: number;
    remaining: number;
    predictedReadiness: number; // 0-100%
  };
  stressLevel?: 'low' | 'medium' | 'high';
  wellnessReminders?: boolean;
}

// Quiz Types
export interface QuizOption {
  id: string;
  text: string;
}

export interface QuizQuestion {
  id: string;
  question: string;
  options: QuizOption[];
  correctAnswer: string;
  explanation: string;
  difficulty: 'easy' | 'medium' | 'hard';
}

export interface Quiz {
  id: string;
  title: string;
  subject: string;
  topic: string;
  difficulty: 'easy' | 'medium' | 'hard';
  questions: QuizQuestion[];
  createdAt: any; // Firestore Timestamp
  createdBy: string; // User UID
}

export interface QuizAttempt {
  id: string;
  quizId: string;
  userId: string;
  answers: { [questionId: string]: string }; // questionId -> selectedOptionId
  score: number;
  totalQuestions: number;
  completedAt: any; // Firestore Timestamp
  timeSpent: number; // seconds
}

export interface QuizPerformance {
  totalAttempts: number;
  averageScore: number;
  bestScore: number;
  totalTimeSpent: number;
  subjectStats: {
    [subject: string]: {
      attempts: number;
      averageScore: number;
    };
  };
}

// Real-Time Collaboration Types

export interface Message {
  id: string;
  studyGroupId: string;
  senderId: string;
  senderName: string;
  senderPhotoURL?: string;
  content: string;
  timestamp: any; // Firestore Timestamp
  edited?: boolean;
  editedAt?: any;
}

export interface Session {
  id: string;
  studyGroupId: string;
  title: string;
  description?: string;
  scheduledAt: any; // Firestore Timestamp
  duration: number; // in minutes
  videoUrl?: string; // Jitsi/Daily.co meeting URL
  createdBy: string;
  createdByName: string;
  status: 'scheduled' | 'active' | 'completed' | 'cancelled';
}

export interface CollaborativeNote {
  id: string;
  studyGroupId: string;
  title: string;
  content: string;
  lastEditedBy: string;
  lastEditedByName: string;
  lastEditedAt: any; // Firestore Timestamp
  createdBy: string;
  createdAt: any;
}

export interface StudyGroup {
  id: string;
  name: string;
  subject: string;
  description?: string;
  branch?: 'CS_IT_DS' | 'AIML_ECE_CYS';
  semester?: string;
  members: string[]; // Array of user IDs
  memberProfiles?: UserProfile[]; // Populated client-side for display
  admins: string[]; // Array of user IDs who can manage the group
  createdBy: string;
  createdByName: string;
  createdAt: any; // Firestore Timestamp
  isPrivate: boolean; // Private groups require approval to join
  maxMembers?: number;
}

// Resource Recommendation System Types
export interface ResourceInteraction {
  id?: string;
  userId: string;
  resourceId: string;
  interactionType: 'view' | 'download' | 'search';
  timestamp: number; // Stored as number in Firestore after serverTimestamp conversion
  subject?: string;
  resourceType?: ResourceType;
  semester?: string;
  branch?: 'CS_IT_DS' | 'AIML_ECE_CYS';
  searchQuery?: string; // Only for search interactions
}

export interface UserPreferences {
  userId: string;
  subjectsViewed: string[];
  downloadHistory: string[];
  searchQueries: string[];
  studyPattern: 'visual' | 'text' | 'mixed';
  preferredResourceTypes: ResourceType[];
  activeSemesters: string[];
}

export interface RecommendationResult {
  resource: Resource;
  score: number;
  reason: 'collaborative' | 'content-based' | 'time-based' | 'popular';
  metadata?: {
    similarUsers?: number;
    matchScore?: number;
    trendingScore?: number;
  };
}

// Learning Analytics Types
export interface StudyTime {
  daily: number[];
  weekly: number[];
  bySubject: Record<string, number>;
}

export interface Performance {
  quizScores: number[];
  improvementRate: number;
  strongTopics: string[];
  weakTopics: string[];
}

export interface Habits {
  mostActiveTime: string;
  preferredResourceTypes: ResourceType[];
  averageSessionLength: number;
}

export interface Predictions {
  examReadiness: number;
  recommendedFocusAreas: string[];
}

export interface LearningAnalytics {
  studyTime: StudyTime;
  performance: Performance;
  habits: Habits;
  predictions: Predictions;
}

export interface StudySession {
  id: string;
  userId: string;
  subject: string;
  resourceType: ResourceType;
  duration: number; // in minutes
  timestamp: Date;
  completed: boolean;
}

export interface QuizResult {
  id: string;
  userId: string;
  topic: string;
  score: number; // percentage
  timestamp: Date;
  totalQuestions: number;
  correctAnswers: number;
}

export interface StudyContext {
  subject: string;
  topic: string;
  difficultyLevel: 'beginner' | 'intermediate' | 'advanced';
  previousInteractions: string[];
}

export interface StudyMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}
