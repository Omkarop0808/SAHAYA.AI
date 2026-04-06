import { createClient } from '@supabase/supabase-js';

let _client = null;

export function isSupabaseEnabled() {
  const url = process.env.SUPABASE_URL?.trim();
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    process.env.SUPABASE_SECRET_KEY?.trim() ||
    process.env.SUPABASE_KEY?.trim();
  return Boolean(url && key);
}

/** Server-side client: use service role (bypasses RLS). Never expose this key to the browser. */
export function getSupabase() {
  if (!isSupabaseEnabled()) return null;
  if (_client) return _client;
  const url = process.env.SUPABASE_URL.trim();
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    process.env.SUPABASE_SECRET_KEY?.trim() ||
    process.env.SUPABASE_KEY?.trim();
  _client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return _client;
}
