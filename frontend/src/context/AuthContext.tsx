import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { supabase, isSupabaseConfigured } from '../supabase';

export interface User {
  id: string;
  email: string;
  name: string;
  cashBalance: number;
  avatarUrl?: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  authError: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (updates: Partial<User>) => void;
  sendResetPassword: (email: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/** Calls the backend to resolve/link/create the StockLab account for a Supabase session. */
async function syncSession(accessToken: string, fallbackName?: string): Promise<User> {
  const res = await fetch('/api/auth/session', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: fallbackName ? JSON.stringify({ name: fallbackName }) : undefined,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || 'Failed to establish session.');
  }
  const { user: u } = await res.json();
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    cashBalance: u.cashBalance,
    avatarUrl: u.avatarUrl || undefined,
  };
}

function mapSupabaseError(err: unknown): string {
  const msg = (err as { message?: string } | null)?.message || 'An unexpected error occurred. Please try again.';
  const lower = msg.toLowerCase();
  if (lower.includes('already registered') || lower.includes('already been registered')) {
    return 'An account with this email already exists. Please log in instead.';
  }
  if (lower.includes('invalid login credentials') || lower.includes('password')) {
    return 'Incorrect email or password. Please try again.';
  }
  if (lower.includes('not found')) {
    return 'No account found with this email. Please sign up first.';
  }
  if (lower.includes('at least 6 characters') || lower.includes('too short')) {
    return 'Password should be at least 6 characters.';
  }
  if (lower.includes('rate limit') || lower.includes('too many')) {
    return 'Too many attempts. Please wait a moment and try again.';
  }
  if (lower.includes('invalid email')) {
    return 'Please enter a valid email address.';
  }
  return msg;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(isSupabaseConfigured);
  const [authError, setAuthError] = useState<string | null>(
    isSupabaseConfigured
      ? null
      : 'Supabase authentication is not configured. Please ask the project owner to complete the setup in frontend/.env and backend/.env.'
  );

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      try {
        if (session?.access_token) {
          const u = await syncSession(session.access_token);
          setUser(u);
        } else {
          setUser(null);
        }
      } catch {
        setUser(null);
      } finally {
        setLoading(false);
      }
    });
    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    if (!supabase) throw new Error(authError || 'Supabase not configured');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error(mapSupabaseError(error));
  }, [authError]);

  const register = useCallback(async (email: string, password: string, name: string) => {
    if (!supabase) throw new Error(authError || 'Supabase not configured');
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name } },
    });
    if (error) throw new Error(mapSupabaseError(error));

    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) throw new Error(mapSupabaseError(sessionError));
    if (sessionData?.session?.access_token) {
      const u = await syncSession(sessionData.session.access_token, name);
      setUser(u);
    }
  }, [authError]);

  const loginWithGoogle = useCallback(async () => {
    if (!supabase) throw new Error(authError || 'Supabase not configured');
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    });
    if (error) throw new Error(mapSupabaseError(error));
  }, [authError]);

  const logout = useCallback(async () => {
    if (supabase) await supabase.auth.signOut();
    setUser(null);
  }, []);

  const updateUser = useCallback((updates: Partial<User>) => {
    setUser(prev => (prev ? { ...prev, ...updates } : null));
  }, []);

  const sendResetPassword = useCallback(async (email: string) => {
    if (!supabase) throw new Error(authError || 'Supabase not configured');
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + '/reset-password',
    });
    if (error) throw new Error(mapSupabaseError(error));
  }, [authError]);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        authError,
        login,
        register,
        loginWithGoogle,
        logout,
        updateUser,
        sendResetPassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
