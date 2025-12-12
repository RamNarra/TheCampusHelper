
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
  // Gamification fields
  xp?: number;
  level?: number;
  streak?: number;
  lastLoginDate?: string; // ISO date string
  achievementIds?: string[];
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
