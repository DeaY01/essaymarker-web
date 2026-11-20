import 'server-only';

import { createSupabaseServerClient } from '@/lib/supabase/server';

export interface CurrentUser {
  id: string;
  email: string;
  fullName: string;
}

/**
 * Returns the signed-in user, or null. The session is verified with Supabase,
 * so the result can be trusted for authorisation. Reads cookies, so callers
 * must render behind a <Suspense> boundary.
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;

  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;

  const { user } = data;
  const metadataName = user.user_metadata?.full_name;
  return {
    id: user.id,
    email: user.email ?? '',
    fullName: typeof metadataName === 'string' ? metadataName : '',
  };
}

/** Accepts only same-site relative paths, to prevent open redirects. */
export function safeRedirectPath(value: unknown, fallback = '/'): string {
  if (typeof value !== 'string') return fallback;
  if (!value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) {
    return fallback;
  }
  return value;
}
