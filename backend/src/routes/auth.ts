import { Router, Response } from 'express';
import { AuthRequest, extractBearerToken, upsertUser } from '../middleware/auth.js';
import { verifySupabaseToken, isSupabaseReady } from '../services/supabase.js';

const router = Router();

interface PublicUser {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  cashBalance: number;
  createdAt: string;
  supabaseUid: string | null;
}

function mapPublicUser(user: any): PublicUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    avatarUrl: user.avatar_url || null,
    cashBalance: user.cash_balance,
    createdAt: user.created_at,
    supabaseUid: user.firebase_uid || null,
  };
}

/**
 * POST /api/auth/session
 * Exchanges a Supabase access token for the StockLab account. The server verifies
 * the token, creates the user record on first sign-in, links legacy rows by
 * e-mail, and returns the account profile (including the persistent virtual
 * cash balance).
 */
router.post('/session', async (req: AuthRequest, res: Response) => {
  if (!isSupabaseReady()) {
    res.status(503).json({
      error: 'Authentication is not configured on this server. Please finish the Supabase setup in backend/.env.',
    });
    return;
  }

  const token = extractBearerToken(req);
  if (!token) {
    res.status(401).json({ error: 'Access token required' });
    return;
  }

  try {
    const decoded = await verifySupabaseToken(token);
    const fallbackName =
      typeof req.body?.name === 'string' && req.body.name.trim() ? req.body.name.trim() : undefined;
    const user = upsertUser(decoded, fallbackName);
    res.json({ user: mapPublicUser(user) });
  } catch {
    res.status(401).json({ error: 'Invalid or expired session token.' });
  }
});

/** GET /api/auth/status - whether the backend has Supabase authentication configured. */
router.get('/status', (_req, res) => {
  res.json({ configured: isSupabaseReady() });
});

export default router;