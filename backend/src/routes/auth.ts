import { Router, Response } from 'express';
import { AuthRequest, extractBearerToken, resolveUser } from '../middleware/auth.js';
import { isFirebaseReady, getFirebaseFailureReason } from '../services/firebase.js';

const router = Router();

interface PublicUser {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  cashBalance: number;
  createdAt: string;
  firebaseUid: string;
}

function mapPublicUser(user: NonNullable<Awaited<ReturnType<typeof resolveUser>>['user']>): PublicUser {
  return {
    id: user.id,
    email: user.email,
    name: user.displayName,
    avatarUrl: user.avatarUrl,
    cashBalance: user.cashBalance,
    createdAt: user.createdAt,
    firebaseUid: user.id,
  };
}

/**
 * POST /api/auth/session
 * Exchanges a Firebase ID token for the StockLab account. The server verifies
 * the token, creates the user's Firestore profile on first sign-in (granting
 * ₹500 virtual cash), and returns the profile (including the persistent
 * virtual cash balance).
 */
router.post('/session', async (req: AuthRequest, res: Response) => {
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
    const fallbackName =
      typeof req.body?.name === 'string' && req.body.name.trim() ? req.body.name.trim() : undefined;
    const { user } = await resolveUser(token, fallbackName);
    res.json({ user: mapPublicUser(user) });
  } catch {
    res.status(401).json({ error: 'Invalid or expired session token.' });
  }
});

/** GET /api/auth/status - whether the backend has Firebase authentication configured. */
router.get('/status', (_req, res) => {
  res.json({ configured: isFirebaseReady(), reason: isFirebaseReady() ? null : getFirebaseFailureReason() });
});

export default router;
