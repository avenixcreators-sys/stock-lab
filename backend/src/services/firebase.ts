import admin from 'firebase-admin';
import type { App, ServiceAccount } from 'firebase-admin/app';
import type { Auth } from 'firebase-admin/auth';
import type { Firestore } from 'firebase-admin/firestore';

/**
 * Firebase Admin bootstrap (server-side only).
 *
 * Reads credentials from the backend environment. Supports several setups:
 *
 *   1. A full service-account JSON provided inline as base64 via
 *      FIREBASE_SERVICE_ACCOUNT_B64, OR
 *   2. Individual fields:
 *        FIREBASE_PROJECT_ID
 *        FIREBASE_CLIENT_EMAIL
 *        FIREBASE_PRIVATE_KEY    (escaped newlines \n are decoded)
 *   3. GOOGLE_APPLICATION_CREDENTIALS pointing at a service-account JSON file.
 *
 * The server still starts if Firebase is not configured, but authenticated
 * routes return a clear "not configured" error instead of crashing.
 */

let ready = false;
let failureReason: string | null = null;
let _app: App | null = null;
let _auth: Auth | null = null;
let _firestore: Firestore | null = null;

function buildCredential(): ServiceAccount | null {
  // 1. Inline full service-account JSON (base64).
  const b64 = process.env.FIREBASE_SERVICE_ACCOUNT_B64;
  if (b64) {
    try {
      const parsed = JSON.parse(Buffer.from(b64, 'base64').toString('utf8')) as ServiceAccount;
      return parsed;
    } catch {
      failureReason = 'FIREBASE_SERVICE_ACCOUNT_B64 is present but is not valid base64/JSON.';
      return null;
    }
  }

  // 2. Individual service-account fields.
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;
  if (projectId && clientEmail && privateKey) {
    // Handle escaped newlines (\n) that often appear in .env values.
    const normalizedKey = privateKey.replace(/\\n/g, '\n');
    return {
      projectId,
      clientEmail,
      privateKey: normalizedKey,
    };
  }

  return null;
}

export function initializeFirebase(): void {
  if (ready || _app) return;

  // 3. GOOGLE_APPLICATION_CREDENTIALS file-based default.
  const fromEnvFile = !!process.env.GOOGLE_APPLICATION_CREDENTIALS;

  const credential = buildCredential();
  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT;

  if (!credential && !fromEnvFile) {
    failureReason =
      'Firebase Admin credentials missing. Provide FIREBASE_SERVICE_ACCOUNT_B64, or ' +
      '(FIREBASE_PROJECT_ID + FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY), or set ' +
      'GOOGLE_APPLICATION_CREDENTIALS in backend/.env.';
    return;
  }

  try {
    _app = credential
      ? admin.initializeApp({
          credential: admin.credential.cert(credential),
          projectId: projectId || undefined,
        })
      : admin.initializeApp({
          credential: admin.credential.applicationDefault(),
          projectId: projectId || undefined,
        });

    _auth = admin.auth(_app);
    _firestore = admin.firestore(_app);
    ready = true;
    failureReason = null;
  } catch (e) {
    failureReason = `Firebase Admin could not initialize: ${(e as Error).message}`;
  }
}

export function isFirebaseReady(): boolean {
  return ready;
}

export function getFirebaseFailureReason(): string | null {
  return failureReason;
}

export function getAuth(): Auth | null {
  return _auth;
}

export function getFirestore(): Firestore | null {
  return _firestore;
}

interface VerifiedUser {
  uid: string;
  email?: string;
  name?: string;
  picture?: string;
  provider?: string;
}

/**
 * Verifies a Firebase ID token. Throws on any failure or misconfiguration.
 * Returns the verified identity — the ONLY trusted source for a user id.
 */
export async function verifyFirebaseToken(idToken: string): Promise<VerifiedUser> {
  if (!ready || !_auth) {
    throw new Error('Firebase authentication is not configured.');
  }
  const decoded = await _auth.verifyIdToken(idToken);

  const info = decoded.firebase?.sign_in_provider || 'password';
  const name =
    (typeof decoded.name === 'string' ? decoded.name : undefined) ||
    (typeof decoded.displayName === 'string' ? decoded.displayName : undefined);
  const picture =
    (typeof decoded.picture === 'string' ? decoded.picture : undefined) ||
    (typeof decoded.picture_url === 'string' ? decoded.picture : undefined);

  return {
    uid: decoded.uid,
    email: typeof decoded.email === 'string' ? decoded.email : undefined,
    name,
    picture,
    provider: info,
  };
}

export type { Firestore, Auth };
