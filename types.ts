
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
