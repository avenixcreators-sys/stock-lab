import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, GraduationCap, Trophy, ArrowRight, CheckCircle2, Target } from 'lucide-react';
import { apiFetch } from '../utils/helpers';
import { LoadingState, ErrorState } from '../components/StateComponents';

interface Lesson {
  id: string;
  title: string;
  slug: string;
  category: string;
  order_index: number;
}

interface Achievement {
  badge_id: string;
  earned_at: string;
}

export default function Learn() {
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [completedLessons, setCompletedLessons] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [lessonsRes, achRes] = await Promise.all([
        apiFetch('/api/learn/lessons'),
        apiFetch('/api/learn/achievements')
      ]);
      const [lessonsData, achData] = await Promise.all([lessonsRes.json(), achRes.json()]);
      setLessons(lessonsData);
      setAchievements(achData.achievements || []);
      setCompletedLessons(achData.completedLessons || 0);
    } catch {
      setError('Failed to load learning content');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (loading) return <LoadingState text="Loading lessons..." height="h-screen" />;
  if (error) return <ErrorState message={error} onRetry={loadData} />;

  const badgeDefinitions = [
    { id: 'first-lesson', name: 'First Steps', desc: 'Complete your first lesson', icon: '🏆', color: 'from-amber-400 to-orange-500' },
    { id: 'five-lessons', name: 'Knowledge Seeker', desc: 'Complete 5 lessons', icon: '🎓', color: 'from-sky-400 to-blue-500' },
    { id: 'ten-lessons', name: 'Market Scholar', desc: 'Complete 10 lessons', icon: '📚', color: 'from-purple-400 to-violet-500' },
    { id: 'all-lessons', name: 'Stock Expert', desc: 'Complete all 12 lessons', icon: '👑', color: 'from-amber-400 to-yellow-500' },
    { id: 'portfolio-builder', name: 'Portfolio Builder', desc: 'Make your first trade', icon: '💼', color: 'from-emerald-400 to-green-500' },
    { id: 'diversified', name: 'Diversifier', desc: 'Hold 5 different stocks', icon: '🌐', color: 'from-teal-400 to-cyan-500' },
    { id: 'watchlist-tracker', name: 'Tracker', desc: 'Add 3 stocks to watchlist', icon: '⭐', color: 'from-pink-400 to-rose-500' },
    { id: 'first-trade', name: 'First Trade', desc: 'Complete your first simulated order', icon: '📈', color: 'from-indigo-400 to-primary-500' },
  ];

  const earnedBadges = new Set(achievements.map(a => a.badge_id));

  return (
    <div className="page-container space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <GraduationCap className="w-7 h-7 text-primary-500" />
          Learning Center
        </h1>
        <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Master the basics of stock market investing</p>
      </div>

      <div className="card bg-gradient-to-br from-primary-50 to-emerald-50 dark:from-primary-950/30 dark:to-emerald-950/30 border-primary-100 dark:border-primary-900">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="p-3 rounded-2xl bg-white dark:bg-gray-900 shadow-sm">
              <Trophy className="w-6 h-6 text-amber-400" />
            </div>
            <div>
              <h2 className="font-semibold text-gray-900 dark:text-white">Your Progress</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {completedLessons} of {lessons.length} lessons completed
              </p>
              <div className="mt-3 flex items-center gap-2 w-48 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-primary-500 to-primary-700 rounded-full transition-all duration-500"
                  style={{ width: `${lessons.length ? Math.min(100, (completedLessons / lessons.length) * 100) : 0}%` }}
                />
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Earn badges by completing lessons and using the app
              </p>
            </div>
          </div>
          <Link to="/learn/achievements" className="btn-secondary self-start md:self-center">View All Badges</Link>
        </div>
      </div>

      <div className="space-y-6">
        <div>
          <h2 className="section-title">Lessons</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {lessons.map((lesson, index) => (
              <Link
                key={lesson.id}
                to={`/learn/${lesson.slug}`}
                className="card group hover:shadow-md hover:-translate-y-0.5 transition-all duration-200"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 font-semibold text-sm">
                      {index + 1}
                    </span>
                    <span className="badge bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 capitalize">
                      {lesson.category}
                    </span>
                  </div>
                  <ArrowRight className="w-4 h-4 text-gray-300 dark:text-gray-600 group-hover:text-primary-500 transition-colors" />
                </div>
                <h3 className="font-semibold text-gray-900 dark:text-white mb-2">{lesson.title}</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">Beginner-friendly lesson with a quiz</p>
              </Link>
            ))}
          </div>
        </div>

        <div>
          <h2 className="section-title">Badges</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {badgeDefinitions.map(badge => {
              const earned = earnedBadges.has(badge.id);
              return (
                <div key={badge.id} className={`card p-4 text-center ${earned ? 'ring-2 ring-primary-500/20' : 'opacity-70'}`}>
                  <div className={`w-12 h-12 mx-auto rounded-2xl bg-gradient-to-br ${badge.color} flex items-center justify-center text-2xl mb-3 ${earned ? '' : 'grayscale'}`}>
                    {badge.icon}
                  </div>
                  <div className="font-semibold text-sm mb-1">{badge.name}</div>
                  <div className="text-xs text-gray-400">{badge.desc}</div>
                  {earned ? (
                    <div className="mt-2 flex items-center justify-center gap-1 text-xs text-success font-medium">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Earned
                    </div>
                  ) : (
                    <div className="mt-2 flex items-center justify-center gap-1 text-xs text-gray-400">
                      <Target className="w-3.5 h-3.5" /> To earn
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
