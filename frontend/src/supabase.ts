import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

/**
 * Whether the Supabase web config was supplied via VITE_SUPABASE_* env vars.
 * When false the app still renders, but sign-in features are disabled with a
 * clear message pointing to frontend/.env.
 */
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

let _supabase: SupabaseClient | null = null;

if (isSupabaseConfigured) {
  _supabase = createClient(supabaseUrl as string, supabaseAnonKey as string, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: 'pkce',
    },
  });
}

/** Supabase client, or null when Supabase is not configured. */
export const supabase: SupabaseClient | null = _supabase;

/**
 * Returns the current Supabase access token for the currently signed-in user,
 * or null if no user is logged in.
 *
 * This is safe to call from anywhere (including inside apiFetch).
 */
export async function getCurrentAccessToken(): Promise<string | null> {
  if (!_supabase) return null;
  const { data } = await _supabase.auth.getSession();
  return data?.session?.access_token ?? null;
}
