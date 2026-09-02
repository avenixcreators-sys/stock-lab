import { Request, Response, NextFunction } from 'express';
import db from '../database.js';
import { verifySupabaseToken, isSupabaseReady } from '../services/supabase.js';

export interface AuthRequest extends Request {
  userId?: string;
  supabaseUid?: string;
}

export function extractBearerToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (header && header.startsWith('Bearer ')) {
    const token = header.slice(7).trim();
    return token.length ? token : null;
  }
  return null;
}

interface SupabaseUser {
  id: string;
  email?: string;
  user_metadata?: Record<string, unknown>;
  app_metadata?: Record<string, unknown>;
}

function metaString(meta: Record<string, unknown> | undefined, key: string): string | undefined {
  const value = meta?.[key];
  return typeof value === 'string' && value ? value : undefined;
}

/**
 * Resolves (or lazily creates) the StockLab user record that corresponds to a
 * verified Supabase account. The Supabase Auth user id is the primary
 * identifier: new users are stored with `id = supabaseUserId`, and legacy rows
 * (created before Supabase was introduced) are linked by e-mail.
 *
 * Returns the fresh user row (never the client-supplied id itself).
 */
export function upsertUser(decoded: SupabaseUser, fallbackName?: string): any {
  const uid = decoded.id;
  const email = (decoded.email || '').trim().toLowerCase() || `${uid}@stocklab.invalid`;
  const provider =
    (decoded.app_metadata?.provider as string) || 'password';

  let user = db.prepare('SELECT * FROM users WHERE firebase_uid = ?').get(uid) as any;

  if (!user && decoded.email) {
    user = db.prepare('SELECT * FROM users WHERE email = ?').get(email) as any;
    if (user) {
      db.prepare(
        `UPDATE users
         SET firebase_uid = ?, provider = COALESCE(provider, ?), updated_at = datetime('now')
         WHERE id = ?`
      ).run(uid, provider, user.id);
    }
  }

  const name = metaString(decoded.user_metadata, 'name') || metaString(decoded.user_metadata, 'full_name');
  const picture = metaString(decoded.user_metadata, 'avatar_url') || metaString(decoded.user_metadata, 'picture');

  if (!user) {
    const id = uid;
    const displayName = fallbackName || name || email || 'Trader';
    db.prepare(
      `INSERT INTO users (id, email, name, firebase_uid, provider, avatar_url, cash_balance, created_at, updated_at, last_login_at)
       VALUES (?, ?, ?, ?, ?, ?, 500.0, datetime('now'), datetime('now'), datetime('now'))`
    ).run(id, email, displayName, uid, provider, picture || null);
  } else {
    const resolvedPicture = picture || user.avatar_url;
    const resolvedName = fallbackName || name || user.name;
    db.prepare(
      `UPDATE users
       SET firebase_uid = ?, provider = COALESCE(provider, ?), avatar_url = ?, name = ?,
           last_login_at = datetime('now'), updated_at = datetime('now')
       WHERE id = ?`
    ).run(uid, provider, resolvedPicture || null, resolvedName, user.id);
  }

  return db.prepare('SELECT * FROM users WHERE id = ?').get(user ? user.id : uid) as any;
}

/** Full authentication: requires a valid Supabase access token and resolves the user row. */
export async function authenticateToken(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
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
    const user = upsertUser(decoded);
    req.userId = user.id;
    req.supabaseUid = decoded.id;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired session. Please sign in again.' });
  }
}

/**
 * Optional authentication: validates a token only when one is supplied.
 * Useful for publicly readable market endpoints that enrich responses for
 * signed-in users (e.g. the watchlist flag on stock details).
 */
export async function optionalAuth(req: AuthRequest, _res: Response, next: NextFunction): Promise<void> {
  if (isSupabaseReady()) {
    const token = extractBearerToken(req);
    if (token) {
      try {
        const decoded = await verifySupabaseToken(token);
        const user = upsertUser(decoded);
        req.userId = user.id;
        req.supabaseUid = decoded.id;
      } catch {
        // ignore invalid tokens on public endpoints
      }
    }
  }
  next();
}
