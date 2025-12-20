import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Trophy, Medal, Crown, TrendingUp } from 'lucide-react';
import { getLeaderboard, calculateLevel } from '../services/gamification';
import { useAuth } from '../context/AuthContext';
import type { LeaderboardEntry } from '../types';
import { Page } from '../components/ui/Page';

const LeaderboardPage: React.FC = () => {
  const { user } = useAuth();
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState<'weekly' | 'monthly' | 'alltime'>('alltime');

  useEffect(() => {
    const loadLeaderboard = async () => {
      setLoading(true);
      try {
        const entries = await getLeaderboard(selectedPeriod, 50);
        setLeaderboard(entries);
      } catch (error) {
        console.error('Failed to load leaderboard:', error);
      } finally {
        setLoading(false);
      }
    };

    loadLeaderboard();
  }, [selectedPeriod]);

  const getRankIcon = (rank: number) => {
    if (rank === 1) return <Crown className="w-5 h-5 text-yellow-400" />;
    if (rank === 2) return <Medal className="w-5 h-5 text-muted-foreground" />;
    if (rank === 3) return <Medal className="w-5 h-5 text-orange-600" />;
    return null;
  };

  const getRankBg = (rank: number) => {
    if (rank === 1) return 'bg-gradient-to-r from-yellow-500/20 to-yellow-600/20 border-yellow-500/30';
    if (rank === 2) return 'bg-gradient-to-r from-gray-400/20 to-gray-500/20 border-gray-400/30';
    if (rank === 3) return 'bg-gradient-to-r from-orange-500/20 to-orange-600/20 border-orange-500/30';
    return 'bg-card border-border';
  };

  return (
    <Page>
      {/* Header */}
      <motion.div
        initial={{ y: 10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="text-center mb-8"
      >
        <h1 className="text-4xl font-bold text-foreground mb-2 flex items-center justify-center gap-3">
          <Trophy className="w-10 h-10 text-primary" />
          Leaderboard
        </h1>
        <p className="text-muted-foreground">
          Compete with your peers and climb to the top!
        </p>
      </motion.div>

      {/* Period Selector */}
      <motion.div
        initial={{ y: 10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="flex justify-center gap-2 mb-8"
      >
        {(['alltime', 'monthly', 'weekly'] as const).map((period) => (
          <button
            key={period}
            onClick={() => setSelectedPeriod(period)}
            className={`px-4 py-2 rounded-lg font-medium text-sm transition-all ${
              selectedPeriod === period
                ? 'bg-primary text-primary-foreground shadow-lg'
                : 'bg-card border border-border text-muted-foreground hover:bg-muted'
            }`}
          >
            {period === 'alltime' ? 'All Time' : period === 'monthly' ? 'This Month' : 'This Week'}
          </button>
        ))}
      </motion.div>

      {/* Leaderboard List */}
      <motion.div
        initial={{ y: 10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm"
      >
        {loading ? (
          <div className="p-8 space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center gap-4 animate-pulse">
                <div className="w-12 h-12 bg-muted rounded-full"></div>
                <div className="flex-1">
                  <div className="h-4 bg-muted rounded w-1/3 mb-2"></div>
                  <div className="h-3 bg-muted rounded w-1/4"></div>
                </div>
                <div className="h-6 bg-muted rounded w-16"></div>
              </div>
            ))}
          </div>
        ) : leaderboard.length === 0 ? (
          <div className="p-12 text-center">
            <TrendingUp className="w-16 h-16 text-muted-foreground mx-auto mb-4 opacity-50" />
            <p className="text-muted-foreground">No leaderboard data available yet.</p>
            <p className="text-sm text-muted-foreground mt-2">Be the first to earn XP!</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {leaderboard.map((entry, index) => {
              const { tier } = calculateLevel(entry.xp);
              const isCurrentUser = user?.uid === entry.uid;

              return (
                <motion.div
                  key={entry.uid}
                  initial={{ x: -20, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: index * 0.05 }}
                  className={`flex items-center gap-4 p-4 transition-colors ${
                    isCurrentUser ? 'bg-primary/5' : 'hover:bg-muted/50'
                  } ${entry.rank <= 3 ? getRankBg(entry.rank) : ''}`}
                >
                  {/* Rank */}
                  <div className="w-12 text-center">
                    {getRankIcon(entry.rank) || (
                      <span className="text-lg font-bold text-muted-foreground">
                        #{entry.rank}
                      </span>
                    )}
                  </div>

                  {/* Avatar */}
                  <div className="relative">
                    <img
                      src={entry.photoURL || `https://ui-avatars.com/api/?name=${entry.displayName}`}
                      alt={entry.displayName || 'User'}
                      className="w-12 h-12 rounded-full border-2 border-background"
                    />
                    {isCurrentUser && (
                      <div className="absolute -bottom-1 -right-1 bg-primary text-primary-foreground text-xs px-1.5 py-0.5 rounded-full font-bold">
                        You
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-foreground truncate">
                      {entry.displayName}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Level {entry.level} • {tier}
                    </div>
                  </div>

                  {/* XP */}
                  <div className="text-right">
                    <div className="font-bold text-foreground text-lg">
                      {entry.xp.toLocaleString()}
                    </div>
                    <div className="text-xs text-muted-foreground">XP</div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </motion.div>

      {/* User Rank Card (if not in top 50) */}
      {user && !leaderboard.find(e => e.uid === user.uid) && (
        <motion.div
          initial={{ y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="mt-6 bg-primary/10 border border-primary/20 rounded-2xl p-6"
        >
          <p className="text-center text-foreground">
            <span className="font-semibold">Keep going!</span> Earn more XP to appear on the leaderboard.
          </p>
        </motion.div>
      )}
    </Page>
  );
};

export default LeaderboardPage;
