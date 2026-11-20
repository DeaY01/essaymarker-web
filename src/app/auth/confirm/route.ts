import type { EmailOtpType } from '@supabase/supabase-js';
import { NextResponse, type NextRequest } from 'next/server';

import { safeRedirectPath } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';

const EMAIL_OTP_TYPES: EmailOtpType[] = ['signup', 'invite', 'magiclink', 'recovery', 'email_change', 'email'];

/**
 * Landing route for links in Supabase auth emails (sign-up confirmation and
 * password reset). Handles both link styles Supabase can send:
 * - `?code=…` (the default PKCE flow), and
 * - `?token_hash=…&type=…` (custom email templates).
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const next = safeRedirectPath(searchParams.get('next'));
  const code = searchParams.get('code');
  const tokenHash = searchParams.get('token_hash');
  const type = searchParams.get('type') as EmailOtpType | null;

  const supabase = await createSupabaseServerClient();

  if (supabase) {
    if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error) return NextResponse.redirect(new URL(next, request.url));
      console.error('Auth code exchange failed:', error.message);
    } else if (tokenHash && type && EMAIL_OTP_TYPES.includes(type)) {
      const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
      if (!error) return NextResponse.redirect(new URL(next, request.url));
      console.error('Auth token verification failed:', error.message);
    }
  }

  const failure = new URL('/sign-in', request.url);
  failure.searchParams.set('error', 'link');
  return NextResponse.redirect(failure);
}
