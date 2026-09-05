import { Request, Response, NextFunction } from 'express';
import { verifyFirebaseToken, isFirebaseReady } from '../services/firebase.js';
import { getOrCreateUser, StoreUser } from '../services/firestoreStore.js';

export interface AuthRequest extends Request {
  userId?: string;
  firebaseUid?: string;
}

export function extractBearerToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (header && header.startsWith('Bearer ')) {
    const token = header.slice(7).trim();
    return token.length ? token : null;
  }
  return null;
}

export interface VerifiedIdentity {
  id: string;
  email?: string;
  name?: string;
  picture?: string;
  provider?: string;
}

/**
 * Verifies a Firebase ID token and resolves/creates the user's Firestore
 * profile. The Firestore balance is initialized to ₹500 only on first creation
 * and is never reset on subsequent logins.
 */
export async function resolveUser(token: string, fallbackName?: string): Promise<{ identity: VerifiedIdentity; user: StoreUser }> {
  const decoded = await verifyFirebaseToken(token);
  const name = fallbackName || decoded.name;
  const user = await getOrCreateUser(decoded.uid, {
    email: decoded.email,
    name,
    photoURL: decoded.picture,
  });
  return {
    identity: { id: decoded.uid, email: decoded.email, name: decoded.name, picture: decoded.picture, provider: decoded.provider },
    user,
  };
}

/** Full authentication: requires a valid Firebase ID token and resolves the user profile. */
export async function authenticateToken(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  if (!isFirebaseReady()) {
    res.status(503).json({
      error: 'Authentication is not configured on this server. Please finish the Firebase setup in backend/.env.',
    });
    return;
  }

  const token = extractBearerToken(req);
  if (!token) {
    res.status(401).json({ error: 'Access token required' });
    return;
  }

  try {
    const { identity } = await resolveUser(token);
    req.userId = identity.id;
    req.firebaseUid = identity.id;
    next();
  } catch (err) {
    // A valid token that fails because the database (Firestore) is unavailable
    // must NOT be reported as an auth failure — that hides the real problem and
    // shows misleading "Failed to load data" errors in the UI.
    const msg = (err as Error)?.message || '';
    if (/firestore|database|datastore|permission.denied|api.*disabled|cloud\.google/i.test(msg)) {
      res.status(503).json({
        error: 'StockLab\'s database is currently unavailable. Please contact the administrator. (' + msg + ')',
      });
      return;
    }
    res.status(401).json({ error: 'Invalid or expired session. Please sign in again.' });
  }
}

/**
 * Optional authentication: validates a token only when one is supplied.
 * Useful for publicly readable market endpoints that enrich responses for
 * signed-in users (e.g. the watchlist flag on stock details).
 */
export async function optionalAuth(req: AuthRequest, _res: Response, next: NextFunction): Promise<void> {
  if (isFirebaseReady()) {
    const token = extractBearerToken(req);
    if (token) {
      try {
        const { identity } = await resolveUser(token);
        req.userId = identity.id;
        req.firebaseUid = identity.id;
      } catch {
        // ignore invalid tokens on public endpoints
      }
    }
  }
  next();
}
