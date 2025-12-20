import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Trophy, Award, TrendingUp, Flame } from 'lucide-react';
import { getUserProgress, calculateLevel } from '../services/gamification';
import type { UserProgress } from '../types';

interface GamificationCardProps {
  uid: string;
}

const GamificationCard: React.FC<GamificationCardProps> = ({ uid }) => {
  const [progress, setProgress] = useState<UserProgress | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadProgress = async () => {
      try {
        const userProgress = await getUserProgress(uid);
        setProgress(userProgress);
      } catch (error) {
        console.error('Failed to load gamification progress:', error);
      } finally {
        setLoading(false);
      }
    };

    loadProgress();
  }, [uid]);

  if (loading) {
    return (
      <div className="bg-card border border-border rounded-2xl p-6 animate-pulse">
        <div className="h-6 bg-muted rounded w-1/3 mb-4"></div>
        <div className="h-4 bg-muted rounded w-2/3 mb-2"></div>
        <div className="h-4 bg-muted rounded w-1/2"></div>
      </div>
    );
  }

  if (!progress) {
    return null;
  }

  const { level, tier, progress: progressPercent } = calculateLevel(progress.xp);

  const tierColors = {
    Bronze: 'from-orange-600 to-orange-800',
    Silver: 'from-gray-400 to-gray-600',
    Gold: 'from-yellow-400 to-yellow-600',
    Platinum: 'from-purple-400 to-purple-600',
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-card border border-border rounded-2xl p-6 shadow-sm"
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl font-bold text-foreground flex items-center gap-2">
          <Trophy className="w-5 h-5 text-primary" />
          Your Progress
        </h3>
         <div className={`px-3 py-1 rounded-full text-xs font-bold bg-gradient-to-r ${tierColors[tier as keyof typeof tierColors]} text-primary-foreground`}>
          Level {level} - {tier}
        </div>
      </div>

      {/* XP Progress Bar */}
      <div className="mb-6">
        <div className="flex items-center justify-between text-sm mb-2">
          <span className="text-muted-foreground">Experience Points</span>
          <span className="font-bold text-foreground">
            {progress.xp} XP {progress.nextLevelXp !== Infinity && `/ ${progress.nextLevelXp} XP`}
          </span>
        </div>
        <div className="w-full bg-muted rounded-full h-3 overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${progressPercent}%` }}
            transition={{ duration: 1, ease: 'easeOut' }}
            className="h-full bg-gradient-to-r from-primary to-secondary rounded-full"
          />
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-3 gap-4">
        <div className="text-center">
          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10 mx-auto mb-2">
            <TrendingUp className="w-5 h-5 text-primary" />
          </div>
          <div className="text-2xl font-bold text-foreground">{level}</div>
          <div className="text-xs text-muted-foreground">Level</div>
        </div>

        <div className="text-center">
          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-orange-500/10 mx-auto mb-2">
            <Flame className="w-5 h-5 text-orange-500" />
          </div>
          <div className="text-2xl font-bold text-foreground">{progress.streak}</div>
          <div className="text-xs text-muted-foreground">Day Streak</div>
        </div>

        <div className="text-center">
          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-secondary/10 mx-auto mb-2">
            <Award className="w-5 h-5 text-secondary" />
          </div>
          <div className="text-2xl font-bold text-foreground">{progress.achievements.length}</div>
          <div className="text-xs text-muted-foreground">Achievements</div>
        </div>
      </div>

      {/* Recent Achievements */}
      {progress.achievements.length > 0 && (
        <div className="mt-6 pt-4 border-t border-border">
          <h4 className="text-sm font-semibold text-foreground mb-3">Recent Achievements</h4>
          <div className="space-y-2">
            {progress.achievements.slice(0, 3).map((achievement) => (
              <div
                key={achievement.id}
                className="flex items-center gap-3 p-2 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
              >
                <span className="text-2xl">{achievement.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-foreground truncate">
                    {achievement.title}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    +{achievement.xpReward} XP
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
};

export default GamificationCard;
