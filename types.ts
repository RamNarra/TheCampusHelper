
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
