import { initializeApp, type FirebaseApp } from 'firebase/app';
import {
  getAuth,
  type Auth,
} from 'firebase/auth';
import {
  getFirestore,
  type Firestore,
} from 'firebase/firestore';

/**
 * Firebase client bootstrap.
 *
 * Only Firestore is the persistent data store for StockLab user state, but the
 * frontend talks to the StockLab backend (Firebase Admin + Firestore) for all
 * reads/writes of portfolio/holdings/transactions so business rules (virtual
 * cash, buy/sell totals) are enforced server-side. The client uses Firebase
 * Authentication only.
 */

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

/**
 * Whether the Firebase web config was supplied via VITE_FIREBASE_* env vars.
 * When false the app still renders, but sign-in features are disabled with a
 * clear message pointing to frontend/.env.
 */
export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey &&
  firebaseConfig.authDomain &&
  firebaseConfig.projectId &&
  firebaseConfig.appId
);

let _app: FirebaseApp | null = null;
let _auth: Auth | null = null;
let _db: Firestore | null = null;

if (isFirebaseConfigured) {
  _app = initializeApp(firebaseConfig);
  _auth = getAuth(_app);
  _db = getFirestore(_app);
}

/** Firebase app, or null when Firebase is not configured. */
export const app: FirebaseApp | null = _app;

// DEBUG-ONLY hook for diagnosing data on the live site. REMOVE after debugging.
if (typeof window !== 'undefined') {
  (window as any).__lab = { app: _app, auth: _auth, db: _db };
}

/** Firebase Auth instance, or null when Firebase is not configured. */
export const auth: Auth | null = _auth;

/** Firestore instance, or null when Firebase is not configured. */
export const db: Firestore | null = _db;

/**
 * Converts a Firebase Auth error (message strings) into a cleaner,
 * user-friendly message appropriate for the StockLab UI.
 */
export function mapFirebaseError(err: unknown): string {
  const msg = (err as { message?: string } | null)?.message || '';
  const code = (err as { code?: string } | null)?.code || '';
  const lower = (msg + ' ' + code).toLowerCase();

  if (lower.includes('already-in-use') || lower.includes('email-already-in-use')) {
    return 'An account with this email already exists. Please log in instead.';
  }
  if (lower.includes('wrong-password') || lower.includes('invalid-credential') || lower.includes('invalid-login-credentials')) {
    return 'Incorrect email or password. Please try again.';
  }
  if (lower.includes('user-not-found')) {
    return 'No account found with this email. Please sign up first.';
  }
  if (lower.includes('weak-password')) {
    return 'Password should be at least 6 characters.';
  }
  if (lower.includes('invalid-email')) {
    return 'Please enter a valid email address.';
  }
  if (lower.includes('too-many-requests')) {
    return 'Too many attempts. Please wait a moment and try again.';
  }
  if (lower.includes('network-request-failed')) {
    return 'Network error. Please check your connection and try again.';
  }
  return msg || 'An unexpected error occurred. Please try again.';
}

/**
 * Returns the current Firebase ID token for the signed-in user, or null if no
 * user is logged in. Safe to call from anywhere (including inside apiFetch).
 */
export async function getCurrentAccessToken(): Promise<string | null> {
  if (!_auth) return null;
  const user = _auth.currentUser;
  if (!user) return null;
  try {
    return await user.getIdToken();
  } catch {
    return null;
  }
}
