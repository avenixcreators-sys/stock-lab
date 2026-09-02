import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Trophy, CheckCircle2, Target } from 'lucide-react';
import { apiFetch } from '../utils/helpers';
import { LoadingState, ErrorState } from '../components/StateComponents';

interface Achievement {
  badge_id: string;
  earned_at: string;
}

interface Lesson {
  id: string;
  title: string;
  slug: string;
}

export default function Achievements() {
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await apiFetch('/api/learn/achievements');
      if (!res.ok) throw new Error('Failed to load achievements');
      const data = await res.json();
      setAchievements(data.achievements || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load achievements');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (loading) return <LoadingState text="Loading achievements..." height="h-screen" />;
  if (error) return <ErrorState message={error} onRetry={loadData} />;

  const badgeDefinitions = [
    { id: 'first-lesson', name: 'First Steps', desc: 'Complete your first lesson quiz', icon: '🏆', color: 'from-amber-400 to-orange-500' },
    { id: 'five-lessons', name: 'Knowledge Seeker', desc: 'Complete 5 lesson quizzes', icon: '🎓', color: 'from-sky-400 to-blue-500' },
    { id: 'ten-lessons', name: 'Market Scholar', desc: 'Complete 10 lesson quizzes', icon: '📚', color: 'from-purple-400 to-violet-500' },
    { id: 'all-lessons', name: 'Stock Expert', desc: 'Complete all 12 lesson quizzes', icon: '👑', color: 'from-amber-400 to-yellow-500' },
    { id: 'portfolio-builder', name: 'Portfolio Builder', desc: 'Make your first simulated trade', icon: '💼', color: 'from-emerald-400 to-green-500' },
    { id: 'diversified', name: 'Diversifier', desc: 'Hold 5 different stocks in your portfolio', icon: '🌐', color: 'from-teal-400 to-cyan-500' },
    { id: 'watchlist-tracker', name: 'Tracker', desc: 'Add 3 stocks to your watchlist', icon: '⭐', color: 'from-pink-400 to-rose-500' },
    { id: 'first-trade', name: 'First Trade', desc: 'Complete your first buy or sell order', icon: '📈', color: 'from-indigo-400 to-primary-500' },
  ];

  const earnedSet = new Set(achievements.map(a => a.badge_id));

  return (
    <div className="page-container space-y-6 animate-fade-in">
      <div>
        <Link to="/learn" className="btn-secondary text-sm inline-flex items-center gap-2 mb-4">
          <ArrowLeft className="w-4 h-4" /> Back to Learning
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <Trophy className="w-7 h-7 text-amber-400" />
          Achievements
        </h1>
        <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
          {achievements.length} of {badgeDefinitions.length} badges earned. Complete activities to earn more!
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {badgeDefinitions.map(badge => {
          const earned = earnedSet.has(badge.id);
          const achievement = achievements.find(a => a.badge_id === badge.id);
          return (
            <div key={badge.id} className={`card p-5 ${earned ? 'ring-2 ring-primary-500/30' : ''}`}>
              <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${badge.color} flex items-center justify-center text-3xl mb-4 ${earned ? '' : 'grayscale opacity-60'}`}>
                {badge.icon}
              </div>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-1">{badge.name}</h3>
              <p className="text-xs text-gray-400 mb-4">{badge.desc}</p>
              {earned && achievement ? (
                <div className="flex items-center justify-center gap-1.5 text-xs font-medium text-success">
                  <CheckCircle2 className="w-4 h-4" />
                  Earned on {new Date(achievement.earned_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                </div>
              ) : (
                <div className="flex items-center justify-center gap-1.5 text-xs font-medium text-gray-400">
                  <Target className="w-4 h-4" />
                  Not yet earned
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
