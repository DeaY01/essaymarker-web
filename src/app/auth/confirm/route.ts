import type { EmailOtpType } from '@supabase/supabase-js';
import { NextResponse, type NextRequest } from 'next/server';

import { safeRedirectPath } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { sendWelcomeEmailIfConfirmed } from '@/lib/welcome-email';

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
    let verified = false;
    if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error) verified = true;
      else console.error('Auth code exchange failed:', error.message);
    } else if (tokenHash && type && EMAIL_OTP_TYPES.includes(type)) {
      const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
      if (!error) verified = true;
      else console.error('Auth token verification failed:', error.message);
    }

    if (verified) {
      const { data, error } = await supabase.auth.getUser();
      if (error) console.error('Could not read confirmed user after auth link:', error.message);
      if (data.user) await sendWelcomeEmailIfConfirmed(data.user);
      return NextResponse.redirect(new URL(next, request.url));
    }
  }

  const failure = new URL('/sign-in', request.url);
  failure.searchParams.set('error', 'link');
  return NextResponse.redirect(failure);
}
