
export type ResourceType = 'Note' | 'PYQ' | 'Lab Record' | 'PPT' | 'MidPaper' | 'ImpQ';

export interface UserProfile {
  uid: string;
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
  role: 'user' | 'admin';
  branch?: 'CS_IT_DS' | 'AIML_ECE_CYS';
  year?: string;
  dateOfBirth?: string; // Format: YYYY-MM-DD
  profileCompleted?: boolean; // New flag to prevent infinite onboarding loops
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
  status?: 'approved' | 'pending';
}

export interface StatMetric {
  label: string;
  value: string;
  change?: string;
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
// Learning Analytics Types
export interface StudyTime {
  daily: number[];
  weekly: number[];
  bySubject: Map<string, number>;
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
