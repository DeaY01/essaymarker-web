'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { z } from 'zod';

import { safeRedirectPath } from '@/lib/auth';
import { SUPABASE_NOT_CONFIGURED } from '@/lib/supabase/config';
import { REFERRAL_COOKIE, normaliseReferralCode } from '@/lib/referral';
import { getSiteOrigin } from '@/lib/site-url';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export interface AuthFormState {
  status: 'idle' | 'error' | 'success';
  message?: string;
  fieldErrors?: Partial<Record<'fullName' | 'email' | 'password', string>>;
  /** Echoed back so fields keep their values after a failed submit. */
  values?: { fullName?: string; email?: string };
}

const PASSWORD_MIN_LENGTH = 8;

const emailSchema = z.string().trim().toLowerCase().pipe(z.email('Enter a valid email address.'));
const passwordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `Use at least ${PASSWORD_MIN_LENGTH} characters.`)
  .max(72, 'Use 72 characters or fewer.');

const signUpSchema = z.object({
  fullName: z.string().trim().min(2, 'Enter your full name.').max(80, 'Use 80 characters or fewer.'),
  email: emailSchema,
  password: passwordSchema,
});

const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Enter your password.'),
});

function fieldErrorsFrom(error: z.ZodError): AuthFormState['fieldErrors'] {
  const fieldErrors: AuthFormState['fieldErrors'] = {};
  for (const issue of error.issues) {
    const field = issue.path[0];
    if ((field === 'fullName' || field === 'email' || field === 'password') && !fieldErrors[field]) {
      fieldErrors[field] = issue.message;
    }
  }
  return fieldErrors;
}

function friendlyAuthError(message: string): string {
  const normalised = message.toLowerCase();
  if (normalised.includes('invalid login credentials')) {
    return 'That email and password don’t match. Check them and try again.';
  }
  if (normalised.includes('email not confirmed')) {
    return 'Please confirm your email first. Check your inbox for the link we sent.';
  }
  if (normalised.includes('rate limit') || normalised.includes('too many')) {
    return 'Too many attempts. Please wait a few minutes and try again.';
  }
  if (normalised.includes('password')) return message;
  return 'Something went wrong. Please try again.';
}

export async function signUp(_previous: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const raw = {
    fullName: String(formData.get('fullName') ?? ''),
    email: String(formData.get('email') ?? ''),
    password: String(formData.get('password') ?? ''),
  };
  const values = { fullName: raw.fullName, email: raw.email };
  const parsed = signUpSchema.safeParse(raw);
  if (!parsed.success) {
    return { status: 'error', fieldErrors: fieldErrorsFrom(parsed.error), values };
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) return { status: 'error', message: SUPABASE_NOT_CONFIGURED, values };

  const next = safeRedirectPath(formData.get('next'));
  const origin = await getSiteOrigin();
  // Partner link (/?ref=CODE) captured earlier in a cookie by the proxy. The
  // database trigger looks the code up and links the new account to its owner.
  const cookieStore = await cookies();
  const referralCode = normaliseReferralCode(cookieStore.get(REFERRAL_COOKIE)?.value);
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: {
        full_name: parsed.data.fullName,
        ...(referralCode ? { referral_code: referralCode } : {}),
      },
      emailRedirectTo: `${origin}/auth/confirm?next=${encodeURIComponent(next)}`,
    },
  });

  if (error) {
    console.error('Sign-up failed:', error.message);
    return { status: 'error', message: friendlyAuthError(error.message), values };
  }

  // The referral has been recorded with the account; it shouldn't apply again.
  if (referralCode) cookieStore.delete(REFERRAL_COOKIE);

  // Email confirmation is turned off in Supabase: the user is signed in already.
  if (data.session) redirect(next);

  // Same message whether or not the email is already registered, so the form
  // can't be used to find out who has an account.
  return {
    status: 'success',
    message: `We’ve sent a confirmation link to ${parsed.data.email}. Open it to finish creating your account.`,
  };
}

export async function signIn(_previous: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const raw = {
    email: String(formData.get('email') ?? ''),
    password: String(formData.get('password') ?? ''),
  };
  const values = { email: raw.email };
  const parsed = signInSchema.safeParse(raw);
  if (!parsed.success) {
    return { status: 'error', fieldErrors: fieldErrorsFrom(parsed.error), values };
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) return { status: 'error', message: SUPABASE_NOT_CONFIGURED, values };

  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    return { status: 'error', message: friendlyAuthError(error.message), values };
  }

  redirect(safeRedirectPath(formData.get('next')));
}

export async function requestPasswordReset(
  _previous: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const email = String(formData.get('email') ?? '');
  const parsed = emailSchema.safeParse(email);
  if (!parsed.success) {
    return {
      status: 'error',
      fieldErrors: { email: parsed.error.issues[0]?.message },
      values: { email },
    };
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) return { status: 'error', message: SUPABASE_NOT_CONFIGURED, values: { email } };

  const origin = await getSiteOrigin();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data, {
    redirectTo: `${origin}/auth/confirm?next=${encodeURIComponent('/reset-password')}`,
  });
  if (error) console.error('Password reset request failed:', error.message);

  // Always the same answer, so the form can't reveal who has an account.
  return {
    status: 'success',
    message: `If an account exists for ${parsed.data}, we’ve sent a link to reset the password.`,
  };
}

export async function updatePassword(
  _previous: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = passwordSchema.safeParse(String(formData.get('password') ?? ''));
  if (!parsed.success) {
    return { status: 'error', fieldErrors: { password: parsed.error.issues[0]?.message } };
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) return { status: 'error', message: SUPABASE_NOT_CONFIGURED };

  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return {
      status: 'error',
      message: 'Your reset link has expired. Request a new one from the sign-in page.',
    };
  }

  const { error } = await supabase.auth.updateUser({ password: parsed.data });
  if (error) {
    return { status: 'error', message: friendlyAuthError(error.message) };
  }

  redirect('/');
}

export async function signOut() {
  const supabase = await createSupabaseServerClient();
  await supabase?.auth.signOut();
  redirect('/sign-in');
}
