import { createClient, SupabaseClient } from '@supabase/supabase-js';
import WebSocket from 'ws';

let ready = false;
let failureReason: string | null = null;
let supabase: SupabaseClient | null = null;

/**
 * Initializes the Supabase client from environment variables.
 *
 * Backend uses the SERVICE_ROLE key because the server is the only party that
 * verifies JWTs and writes to the user-owned tables. Public (anon) key is only
 * needed by the frontend. The server also keeps its SQLite database for the
 * demo market simulation; PostgreSQL (Supabase) is used for production auth
 * and persistence.
 *
 * This is safe to call even when Supabase is not configured: the app keeps
 * running with unauthenticated endpoints clearly disabled instead of crashing.
 */
export function initializeSupabase(): void {
  if (ready || supabase) {
    return;
  }

  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    failureReason =
      'SUPABASE_URL and/or SUPABASE_SERVICE_ROLE_KEY are not set in backend/.env';
    return;
  }

  try {
    supabase = createClient(url, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
      // Node < 22 has no native WebSocket; supply the `ws` transport.
      realtime: { transport: WebSocket as unknown as any },
    });
    ready = true;
    failureReason = null;
  } catch (err) {
    failureReason = `Supabase initialization failed: ${err && (err as Error).message ? (err as Error).message : String(err)}`;
  }
}

export function isSupabaseReady(): boolean {
  return ready;
}

export function getSupabaseFailureReason(): string | null {
  return failureReason;
}

/**
 * Verifies a Supabase access (JWT) token and returns the authenticated user.
 * Throws an error when the token is invalid/expired.
 */
export async function verifySupabaseToken(accessToken: string): Promise<{
  id: string;
  email?: string;
  user_metadata?: Record<string, unknown>;
  app_metadata?: Record<string, unknown>;
}> {
  if (!ready || !supabase) {
    throw new Error('Supabase authentication is not configured.');
  }
  const { data, error } = await supabase.auth.getUser(accessToken);
  if (error || !data?.user) {
    throw error || new Error('Invalid Supabase token.');
  }
  return data.user;
}

/** Exposes the configured server-side Supabase client (null when not configured). */
export function getSupabase(): SupabaseClient | null {
  return supabase;
}
