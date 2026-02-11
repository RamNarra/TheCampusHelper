
// System-defined, non-editable resource categories under each subject.
// NOTE: Legacy docs may still contain other strings in Firestore, but the UI/backend
// normalize them into these categories.
export type ResourceType = 'PPT' | 'MidPaper' | 'PYQ' | 'ImpQ';

// Platform roles (new) + legacy roles (back-compat with existing documents).
export type UserRole = 'super_admin' | 'admin' | 'moderator' | 'instructor' | 'student' | 'user' | 'mod';

// Branch identifiers.
// NOTE: Keep legacy grouped keys for backwards compatibility with existing user/profile docs.
export type BranchKey =
  | 'CSE'
  | 'IT'
  | 'DS'
  | 'AIML'
  | 'CYS'
  | 'ECE'
  | 'EEE'
  | 'MECH'
  | 'CIVIL';

export interface UserProfile {
  uid: string;
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
  role: UserRole;
  disabled?: boolean;
  branch?: BranchKey;
  rollNumber?: string;
  batch?: string; // e.g. "2025-2029"
  year?: string;
  section?: string;
  dateOfBirth?: string; // Format: YYYY-MM-DD
  collegeEmail?: string;
  profileCompleted?: boolean; // New flag to prevent infinite onboarding loops
  // Gamification fields
  xp?: number;
  level?: number;
  streak?: number;
  lastLoginDate?: string; // ISO date string
  achievementIds?: string[];
  studyPattern?: 'visual' | 'text' | 'mixed'; // Learning preference
}

// --- PRESENCE (REAL-TIME ONLINE/OFFLINE) ---
export type PresenceState = 'online' | 'idle' | 'offline';

export interface Presence {
  uid: string;
  state: PresenceState;
  lastSeen?: any; // Firestore Timestamp
  updatedAt?: any; // Firestore Timestamp
  displayName?: string | null;
  photoURL?: string | null;
}

// --- COURSES / ENROLLMENTS (FOUNDATION) ---

export interface Course {
  id: string;
  name: string;
  code: string; // e.g. "CS301"
  term: string; // e.g. "2025-Fall" or "JNTUH-III-I"
  description?: string;
  archived?: boolean;
  createdBy: string;
  createdAt: any;
  updatedAt?: any;
}

export type CourseEnrollmentRole = 'student' | 'instructor';
export type EnrollmentStatus = 'active' | 'removed';

export interface Enrollment {
  id: string;
  courseId: string;
  userId: string;
  role: CourseEnrollmentRole;
  status: EnrollmentStatus;
  createdAt: any;
  updatedAt?: any;
  createdBy: string;
}

// --- UNIFIED CALENDAR / EVENTS (FOUNDATION) ---

export type CalendarEventType =
  | 'assignment_deadline'
  | 'test_window'
  | 'live_test'
  | 'class_event';

export interface CalendarEvent {
  id: string;
  type: CalendarEventType;
  title: string;
  description?: string;
  startMillis: number;
  endMillis: number;
  // Course-scoped event
  courseId?: string;
  courseName?: string;
  // Metadata
  createdBy: string;
  createdAt: any;
  updatedAt?: any;
  source: 'course' | 'personal';
}

export interface Resource {
  id: string;
  title: string;
  subject: string;
  branch: BranchKey;
  semester: string; // "1" through "8"
  type: ResourceType;
  // Optional back-compat marker for migrated resources.
  legacyType?: string;
  downloadUrl: string;
  // Legacy (back-compat): historical Google Drive resources.
  // The UI no longer embeds Drive previews.
  driveFileId?: string;

  // Modern upload metadata (preferred)
  mimeType?: string;
  originalFileName?: string;
  fileSizeBytes?: number;
  storagePath?: string;
  status?: 'approved' | 'pending' | 'rejected';
  ownerId?: string;
  reviewedBy?: string;
  reviewedAt?: any;
  rejectionReason?: string;
  createdAt?: any; // Firestore Timestamp
  updatedAt?: any; // Firestore Timestamp
}

export interface TodoItem {
  id: string;
  uid: string;
  date: string; // YYYY-MM-DD
  title: string;
  completed: boolean;
  createdAt?: any;
  updatedAt?: any;
}

export interface Habit {
  id: string;
  uid: string;
  name: string;
  completions?: Record<string, boolean>; // date -> completed
  createdAt?: any;
  updatedAt?: any;
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
  kind?: 'text' | 'file' | 'audio';
  fileUrl?: string;
  fileName?: string;
  mimeType?: string;
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
  branch?: BranchKey;
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

export interface StudyGroupRequest {
  id: string;
  name: string;
  purpose: string;
  subject: string; // "General" for general-purpose groups
  visibleToYears: string[]; // e.g. ["1","2","3","4"]
  requestedBy: string;
  requestedByName: string;
  createdAt: any;
  status: 'pending' | 'approved' | 'rejected';
  reviewedBy?: string;
  reviewedAt?: any;
  rejectionReason?: string;
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
  branch?: BranchKey;
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
