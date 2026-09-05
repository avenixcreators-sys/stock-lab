import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import {
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  sendPasswordResetEmail,
  updateProfile,
  type User as FirebaseUser,
} from 'firebase/auth';
import { auth, isFirebaseConfigured, mapFirebaseError } from '../firebase';

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

interface SessionUser {
  id: string;
  email: string;
  name: string;
  cashBalance: number;
  avatarUrl?: string;
}

/**
 * Tells the backend (Firebase Admin) to resolve/link/create the StockLab
 * Firestore account for a Firebase ID token. The backend is the authority for
 * the virtual cash balance and ensures ₹500 is granted only on first creation.
 */
async function syncSession(idToken: string, fallbackName?: string): Promise<SessionUser> {
  const res = await fetch('/api/auth/session', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
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

function fromFirebaseUser(fb: FirebaseUser, backend?: SessionUser): SessionUser {
  return {
    id: backend?.id ?? fb.uid,
    email: backend?.email ?? fb.email ?? '',
    name: backend?.name ?? fb.displayName ?? '',
    cashBalance: backend?.cashBalance ?? 0,
    avatarUrl: backend?.avatarUrl ?? fb.photoURL ?? undefined,
  };
}

async function getToken(): Promise<string | null> {
  if (!auth?.currentUser) return null;
  try {
    return await auth.currentUser.getIdToken();
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(isFirebaseConfigured);
  const [authError, setAuthError] = useState<string | null>(
    isFirebaseConfigured
      ? null
      : 'Firebase authentication is not configured. Please ask the project owner to complete the setup in frontend/.env and backend/.env.'
  );

  useEffect(() => {
    if (!auth) {
      setLoading(false);
      return;
    }
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      try {
        if (fbUser) {
          const token = await fbUser.getIdToken();
          if (token) {
            const backend = await syncSession(token);
            setUser(fromFirebaseUser(fbUser, backend));
          } else {
            setUser(fromFirebaseUser(fbUser));
          }
        } else {
          setUser(null);
        }
      } catch {
        // Backend unavailable — fall back to the Firebase user so the app is
        // not hard-locked, but data endpoints that need the backend will fail.
        if (fbUser) setUser(fromFirebaseUser(fbUser));
        else setUser(null);
      } finally {
        setLoading(false);
      }
    });
    return unsubscribe;
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    if (!auth) throw new Error(authError || 'Firebase not configured');
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err) {
      throw new Error(mapFirebaseError(err));
    }
  }, [authError]);

  const register = useCallback(async (email: string, password: string, name: string) => {
    if (!auth) throw new Error(authError || 'Firebase not configured');
    const cleanName = (name || '').trim();
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      try {
        await updateProfile(cred.user, { displayName: cleanName });
      } catch {
        // profile update is best-effort; syncSession will set the name too
      }
      const token = await getToken();
      if (token) {
        const backend = await syncSession(token, cleanName);
        setUser(fromFirebaseUser(cred.user, backend));
      } else {
        setUser(fromFirebaseUser(cred.user));
      }
    } catch (err) {
      throw new Error(mapFirebaseError(err));
    }
  }, [authError]);

  const loginWithGoogle = useCallback(async () => {
    if (!auth) throw new Error(authError || 'Firebase not configured');
    try {
      await signInWithPopup(auth, new GoogleAuthProvider());
    } catch (err) {
      throw new Error(mapFirebaseError(err));
    }
  }, [authError]);

  const logout = useCallback(async () => {
    if (auth) await signOut(auth);
    setUser(null);
  }, []);

  const updateUser = useCallback((updates: Partial<User>) => {
    setUser(prev => (prev ? { ...prev, ...updates } : null));
  }, []);

  const sendResetPassword = useCallback(async (email: string) => {
    if (!auth) throw new Error(authError || 'Firebase not configured');
    try {
      await sendPasswordResetEmail(auth, email);
    } catch (err) {
      throw new Error(mapFirebaseError(err));
    }
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
