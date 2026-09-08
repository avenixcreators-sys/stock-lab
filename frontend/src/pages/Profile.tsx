import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, User, Mail, Wallet, Briefcase, TrendingUp, BookOpen, Trophy, Pencil, X, Check } from 'lucide-react';
import { apiFetch, formatCompact } from '../utils/helpers';
import { LoadingState, ErrorState } from '../components/StateComponents';
import { useAuth } from '../context/AuthContext';


interface ProfileData {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  cashBalance: number;
  createdAt: string;
  stats: {
    transactions: number;
    achievements: number;
    lessonsCompleted: number;
  };
}

export default function Profile() {
  const navigate = useNavigate();
  const { user, logout, updateUser } = useAuth();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  const loadProfile = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await apiFetch('/api/user/profile');
      if (!res.ok) throw new Error('Failed to load profile');
      const data = await res.json();
      console.log('[DEBUGPROF]', JSON.stringify({ name: data.name, stats: data.stats }));
      setProfile(data);
      setName(data.name);
    } catch (err: any) {
      setError(err.message || 'Failed to load profile');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const saveName = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const res = await apiFetch('/api/user/profile', {
        method: 'PUT',
        body: JSON.stringify({ name: name.trim() })
      });
      if (!res.ok) throw new Error('Failed to update');
      updateUser({ name: name.trim() });
      if (profile) setProfile({ ...profile, name: name.trim() });
      setEditing(false);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingState text="Loading profile..." height="h-screen" />;
  if (error) return <ErrorState message={error} onRetry={loadProfile} />;
  if (!profile) return <ErrorState message="Unable to load profile." onRetry={loadProfile} />;

  const statCards = [
    { label: 'Transactions', value: profile.stats.transactions, icon: TrendingUp, color: 'text-primary-500', bg: 'bg-primary-50 dark:bg-primary-900/30' },
    { label: 'Lessons Completed', value: profile.stats.lessonsCompleted, icon: BookOpen, color: 'text-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-900/30' },
    { label: 'Badges Earned', value: profile.stats.achievements, icon: Trophy, color: 'text-amber-500', bg: 'bg-amber-50 dark:bg-amber-900/30' },
  ];
  console.log('[DEBUGRENDER]', JSON.stringify({ tx: profile.stats.transactions, lc: profile.stats.lessonsCompleted, ach: profile.stats.achievements, keys: Object.keys(profile.stats || {}) }));

  return (
    <div className="page-container space-y-6 animate-fade-in">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Profile</h1>

      <div className="grid md:grid-cols-3 gap-6">
        <div className="card md:col-span-1">
          <div className="flex flex-col items-center text-center mb-4">
            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center text-4xl font-bold text-white mb-4 shadow-lg">
              {profile.name.charAt(0).toUpperCase()}
            </div>
            {editing ? (
              <div className="w-full space-y-2">
                <input
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="input-field"
                  placeholder="Your name"
                />
                <div className="flex gap-2">
                  <button onClick={saveName} disabled={saving} className="btn-success flex-1 text-sm">
                    {saving ? 'Saving...' : <span className="inline-flex items-center gap-1"><Check className="w-4 h-4" /> Save</span>}
                  </button>
                  <button onClick={() => { setEditing(false); setName(profile.name); }} className="btn-secondary text-sm">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ) : (
              <>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-1">{profile.name}</h2>
                <button
                  onClick={() => setEditing(true)}
                  className="text-sm text-primary-600 dark:text-primary-400 hover:underline inline-flex items-center gap-1"
                >
                  <Pencil className="w-3.5 h-3.5" /> Edit Name
                </button>
              </>
            )}
          </div>

          <div className="space-y-2 pt-4 border-t border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
              <Mail className="w-4 h-4 text-gray-400" /> {profile.email}
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
              <User className="w-4 h-4 text-gray-400" /> Member since {new Date(profile.createdAt).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
              <Wallet className="w-4 h-4 text-gray-400" /> {formatCompact(profile.cashBalance)} Virtual Cash balance
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="btn-danger w-full mt-6 flex items-center justify-center gap-2"
          >
            <LogOut className="w-4 h-4" /> Logout
          </button>
        </div>

        <div className="md:col-span-2 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {statCards.map(stat => (
              <div key={stat.label} className="card text-center">
                <div className={`w-10 h-10 mx-auto rounded-xl ${stat.bg} flex items-center justify-center mb-3`}>
                  <stat.icon className={`w-5 h-5 ${stat.color}`} />
                </div>
                <div className="text-2xl font-bold text-gray-900 dark:text-white">{stat.value}</div>
                <div className="text-xs text-gray-500 mt-1">{stat.label}</div>
              </div>
            ))}
          </div>

          <div className="card">
            <h2 className="section-title flex items-center gap-2">
              <Briefcase className="w-5 h-5 text-primary-500" />
              Simulated Account
            </h2>
            <div className="space-y-4">
              <div className="flex justify-between items-center p-4 rounded-xl bg-gray-50 dark:bg-gray-800">
                <div>
                  <div className="font-medium">Virtual Cash Balance</div>
                  <div className="text-xs text-gray-500">Starting balance: ₹1000 Virtual Cash</div>
                </div>
                <div className="text-xl font-bold">{formatCompact(profile.cashBalance)}</div>
              </div>
              <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                <h3 className="font-medium text-amber-800 dark:text-amber-200 mb-2">Educational Simulation Notice</h3>
                <p className="text-sm text-amber-700 dark:text-amber-200/80">
                  StockLab is an educational stock-market simulator. All money and trades are virtual.
                  This app does not execute real trades or provide a brokerage account. Your balance
                  and holdings have no real-world monetary value.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
