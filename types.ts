
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
