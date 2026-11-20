import 'server-only';

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

import { getSupabaseConfig } from '@/lib/supabase/config';

/**
 * Creates a Supabase client bound to the current request's cookies.
 * Create a new one per request; never share it between requests.
 * Returns null when Supabase is not configured.
 */
export async function createSupabaseServerClient() {
  const config = getSupabaseConfig();
  if (!config) return null;

  const cookieStore = await cookies();

  return createServerClient(config.url, config.publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Called from a Server Component, where cookies are read-only.
          // The proxy refreshes the session cookies, so this is safe to ignore.
        }
      },
    },
  });
}
