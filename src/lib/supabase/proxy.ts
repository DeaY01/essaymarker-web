import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

import {
  normaliseReferralCode,
  REFERRAL_COOKIE,
  REFERRAL_COOKIE_MAX_AGE,
  REFERRAL_PARAM,
} from '@/lib/referral';
import { getSupabaseConfig } from '@/lib/supabase/config';

/** Pages for signed-out visitors; signed-in users are sent to the app instead. */
const GUEST_ONLY_PATHS = ['/sign-in', '/sign-up'];

/** Pages anyone may open. Everything else requires a signed-in user. */
const PUBLIC_PATHS = [...GUEST_ONLY_PATHS, '/forgot-password', '/reset-password'];
const PUBLIC_PREFIXES = ['/auth/'];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.includes(pathname) || PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

/** Redirect that keeps any session cookies set while handling this request. */
function redirectTo(url: URL, response: NextResponse) {
  const redirect = NextResponse.redirect(url);
  for (const cookie of response.cookies.getAll()) redirect.cookies.set(cookie);
  for (const header of ['cache-control', 'expires', 'pragma']) {
    const value = response.headers.get(header);
    if (value) redirect.headers.set(header, value);
  }
  return redirect;
}

/**
 * Remembers which partner sent a signed-out visitor (?ref=CODE), so the
 * referral can be credited when they sign up. First partner wins: an existing
 * cookie is not overwritten. The cookie is HTTP-only, so page scripts can't
 * read or change it.
 */
function captureReferral(request: NextRequest, response: NextResponse, isSignedIn: boolean) {
  if (isSignedIn || request.nextUrl.pathname.startsWith('/api/')) return response;
  const code = normaliseReferralCode(request.nextUrl.searchParams.get(REFERRAL_PARAM));
  if (!code || request.cookies.has(REFERRAL_COOKIE)) return response;

  response.cookies.set(REFERRAL_COOKIE, code, {
    httpOnly: true,
    secure: request.nextUrl.protocol === 'https:',
    sameSite: 'lax',
    path: '/',
    maxAge: REFERRAL_COOKIE_MAX_AGE,
  });
  return response;
}

/**
 * Runs before every page and API request:
 * - refreshes the Supabase session cookie so Server Components see a valid session;
 * - sends signed-out visitors to /sign-in (remembering where they were going);
 * - sends signed-in users away from the sign-in and sign-up pages.
 * API routes are not redirected; they check the session themselves and return 401.
 */
export async function updateSession(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  let response = NextResponse.next({ request });
  let isSignedIn = false;

  const config = getSupabaseConfig();
  if (config) {
    const supabase = createServerClient(config.url, config.publishableKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
          // Stops CDNs from caching a response that carries someone's session.
          for (const [key, value] of Object.entries(headers)) {
            response.headers.set(key, value);
          }
        },
      },
    });

    // Do not run code between creating the client and this call: it refreshes
    // the session and must happen before anything reads the user.
    const { data } = await supabase.auth.getClaims();
    isSignedIn = Boolean(data?.claims?.sub);
  }

  if (pathname.startsWith('/api/')) return response;

  if (isSignedIn && GUEST_ONLY_PATHS.includes(pathname)) {
    return redirectTo(new URL('/', request.url), response);
  }

  if (!isSignedIn && !isPublicPath(pathname)) {
    // A partner link to any page (e.g. /?ref=CODE) lands on sign-up, keeping the code.
    const referral = normaliseReferralCode(request.nextUrl.searchParams.get(REFERRAL_PARAM));
    const target = new URL(referral ? '/sign-up' : '/sign-in', request.url);
    const destination = `${pathname}${search}`;
    if (referral) target.searchParams.set(REFERRAL_PARAM, referral);
    else if (destination !== '/') target.searchParams.set('next', destination);
    return captureReferral(request, redirectTo(target, response), isSignedIn);
  }

  return captureReferral(request, response, isSignedIn);
}
