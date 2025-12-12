import { 
  doc, 
  setDoc, 
  getDoc, 
  collection, 
  query, 
  orderBy, 
  limit, 
  getDocs,
  updateDoc,
  increment,
  serverTimestamp
} from 'firebase/firestore';
import { db } from './firebase';
import type { Achievement, UserProgress, LeaderboardEntry, AchievementCategory } from '../types';

// XP Configuration
export const XP_REWARDS = {
  LOGIN: 10,
  DAILY_STREAK: 25,
  RESOURCE_VIEW: 5,
  RESOURCE_UPLOAD: 50,
  HELP_PEER: 30,
  PROFILE_COMPLETE: 100,
} as const;

// Level Thresholds
const LEVEL_THRESHOLDS = [
  { level: 1, minXp: 0, maxXp: 100, tier: 'Bronze' },
  { level: 2, minXp: 100, maxXp: 250, tier: 'Bronze' },
  { level: 3, minXp: 250, maxXp: 500, tier: 'Silver' },
  { level: 4, minXp: 500, maxXp: 1000, tier: 'Silver' },
  { level: 5, minXp: 1000, maxXp: 2000, tier: 'Gold' },
  { level: 6, minXp: 2000, maxXp: 4000, tier: 'Gold' },
  { level: 7, minXp: 4000, maxXp: 8000, tier: 'Platinum' },
  { level: 8, minXp: 8000, maxXp: Infinity, tier: 'Platinum' },
];

// Predefined Achievements
const ACHIEVEMENTS: Omit<Achievement, 'unlockedAt'>[] = [
  {
    id: 'first_login',
    title: 'Welcome Aboard!',
    description: 'Complete your first login',
    icon: '🎉',
    category: 'login',
    xpReward: 10,
    badgeType: 'bronze',
  },
  {
    id: 'week_streak',
    title: 'Week Warrior',
    description: 'Maintain a 7-day login streak',
    icon: '🔥',
    category: 'streak',
    xpReward: 100,
    badgeType: 'silver',
  },
  {
    id: 'first_resource',
    title: 'Knowledge Seeker',
    description: 'View your first resource',
    icon: '📚',
    category: 'resources',
    xpReward: 5,
    badgeType: 'bronze',
  },
  {
    id: 'contributor',
    title: 'Generous Contributor',
    description: 'Upload your first resource',
    icon: '🎁',
    category: 'contribution',
    xpReward: 50,
    badgeType: 'gold',
  },
  {
    id: 'resource_master',
    title: 'Resource Master',
    description: 'View 50 resources',
    icon: '🏆',
    category: 'resources',
    xpReward: 200,
    badgeType: 'platinum',
  },
];

/**
 * Calculate level and progress from XP
 */
export function calculateLevel(xp: number): { level: number; tier: string; nextLevelXp: number; progress: number } {
  let currentLevel = LEVEL_THRESHOLDS[0];
  
  for (const threshold of LEVEL_THRESHOLDS) {
    if (xp >= threshold.minXp && xp < threshold.maxXp) {
      currentLevel = threshold;
      break;
    }
  }
  
  const progressInLevel = xp - currentLevel.minXp;
  const xpNeededForLevel = currentLevel.maxXp - currentLevel.minXp;
  const progress = xpNeededForLevel === Infinity ? 100 : (progressInLevel / xpNeededForLevel) * 100;
  
  return {
    level: currentLevel.level,
    tier: currentLevel.tier,
    nextLevelXp: currentLevel.maxXp === Infinity ? currentLevel.minXp : currentLevel.maxXp,
    progress: Math.min(progress, 100),
  };
}

/**
 * Award XP to a user and update their profile
 */
export async function awardXP(uid: string, amount: number, reason: string): Promise<void> {
  if (!db) {
    console.warn('Database not configured');
    return;
  }

  try {
    const userRef = doc(db, 'users', uid);
    
    // Update XP and level
    await updateDoc(userRef, {
      xp: increment(amount),
      lastXpReason: reason,
      lastXpDate: serverTimestamp(),
    });

    // Get updated user data to recalculate level
    const userSnap = await getDoc(userRef);
    if (userSnap.exists()) {
      const userData = userSnap.data();
      const newXp = userData.xp || 0;
      const { level } = calculateLevel(newXp);
      
      // Update level if it changed
      if (level !== userData.level) {
        await updateDoc(userRef, { level });
      }
    }

    console.log(`Awarded ${amount} XP to ${uid} for ${reason}`);
  } catch (error) {
    console.error('Failed to award XP:', error);
  }
}

/**
 * Check and update daily streak
 */
export async function updateStreak(uid: string): Promise<number> {
  if (!db) return 0;

  try {
    const userRef = doc(db, 'users', uid);
    const userSnap = await getDoc(userRef);
    
    if (!userSnap.exists()) return 0;

    const userData = userSnap.data();
    const lastLoginDate = userData.lastLoginDate;
    const currentStreak = userData.streak || 0;
    const today = new Date().toISOString().split('T')[0];

    // Already logged in today
    if (lastLoginDate === today) {
      return currentStreak;
    }

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    let newStreak = 1;
    if (lastLoginDate === yesterdayStr) {
      // Consecutive day
      newStreak = currentStreak + 1;
    }

    await updateDoc(userRef, {
      streak: newStreak,
      lastLoginDate: today,
    });

    // Award streak bonus
    if (newStreak > 1) {
      await awardXP(uid, XP_REWARDS.DAILY_STREAK, `${newStreak}-day streak`);
    }

    return newStreak;
  } catch (error) {
    console.error('Failed to update streak:', error);
    return 0;
  }
}

/**
 * Get user progress with achievements
 */
export async function getUserProgress(uid: string): Promise<UserProgress | null> {
  if (!db) return null;

  try {
    const userRef = doc(db, 'users', uid);
    const userSnap = await getDoc(userRef);
    
    if (!userSnap.exists()) return null;

    const userData = userSnap.data();
    const xp = userData.xp || 0;
    const { level, nextLevelXp } = calculateLevel(xp);
    
    // Get unlocked achievements
    const achievementIds = userData.achievementIds || [];
    const achievementDates = userData.achievementDates || {};
    const achievements = ACHIEVEMENTS.filter(a => achievementIds.includes(a.id))
      .map(a => ({ ...a, unlockedAt: achievementDates[a.id] || undefined }));

    return {
      level,
      xp,
      achievements,
      streak: userData.streak || 0,
      nextLevelXp,
    };
  } catch (error) {
    console.error('Failed to get user progress:', error);
    return null;
  }
}

/**
 * Unlock an achievement for a user
 */
export async function unlockAchievement(uid: string, achievementId: string): Promise<boolean> {
  if (!db) return false;

  try {
    const userRef = doc(db, 'users', uid);
    const userSnap = await getDoc(userRef);
    
    if (!userSnap.exists()) return false;

    const userData = userSnap.data();
    const achievementIds = userData.achievementIds || [];

    // Check if already unlocked
    if (achievementIds.includes(achievementId)) {
      return false;
    }

    const achievement = ACHIEVEMENTS.find(a => a.id === achievementId);
    if (!achievement) return false;

    const achievementDates = userData.achievementDates || {};
    
    // Unlock achievement
    await updateDoc(userRef, {
      achievementIds: [...achievementIds, achievementId],
      achievementDates: {
        ...achievementDates,
        [achievementId]: new Date().toISOString(),
      },
    });

    // Award XP
    await awardXP(uid, achievement.xpReward, `Achievement: ${achievement.title}`);

    return true;
  } catch (error) {
    console.error('Failed to unlock achievement:', error);
    return false;
  }
}

/**
 * Get leaderboard entries
 */
export async function getLeaderboard(period: 'weekly' | 'monthly' | 'alltime' = 'alltime', limitCount = 50): Promise<LeaderboardEntry[]> {
  if (!db) return [];

  try {
    const usersRef = collection(db, 'users');
    const q = query(usersRef, orderBy('xp', 'desc'), limit(limitCount));
    const snapshot = await getDocs(q);

    const entries: LeaderboardEntry[] = [];
    let rank = 1;

    snapshot.forEach((doc) => {
      const data = doc.data();
      entries.push({
        uid: doc.id,
        displayName: data.displayName || 'Anonymous',
        photoURL: data.photoURL || null,
        xp: data.xp || 0,
        level: data.level || 1,
        rank: rank++,
      });
    });

    return entries;
  } catch (error) {
    console.error('Failed to get leaderboard:', error);
    return [];
  }
}

/**
 * Initialize gamification for a new user
 */
export async function initializeGamification(uid: string): Promise<void> {
  if (!db) return;

  try {
    const userRef = doc(db, 'users', uid);
    const userSnap = await getDoc(userRef);
    
    if (!userSnap.exists()) return;

    const userData = userSnap.data();
    
    // Only initialize if not already done
    if (userData.xp !== undefined) return;

    await updateDoc(userRef, {
      xp: 0,
      level: 1,
      streak: 0,
      achievementIds: [],
      lastLoginDate: new Date().toISOString().split('T')[0],
    });

    // Award first login achievement
    await unlockAchievement(uid, 'first_login');
  } catch (error) {
    console.error('Failed to initialize gamification:', error);
  }
}

export { ACHIEVEMENTS };
