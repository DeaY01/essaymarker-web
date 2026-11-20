import 'server-only';

import { createClient } from '@supabase/supabase-js';

import { getSupabaseConfig } from '@/lib/supabase/config';

/**
 * A Supabase client with the service-role (secret) key. It bypasses Row Level
 * Security, so use it only on the server, only for operations students must
 * not be able to perform themselves (changing unit balances), and never with
 * input that hasn't been checked. Returns null when the key isn't set.
 */
export function createSupabaseAdminClient() {
  const config = getSupabaseConfig();
  const secretKey =
    process.env.SUPABASE_SECRET_KEY?.trim() || process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!config || !secretKey) return null;

  return createClient(config.url, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
