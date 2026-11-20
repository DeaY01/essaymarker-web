// Referral codes and the cookie that remembers which partner sent a visitor.
// Client-safe and edge-safe (used by the proxy).

export const REFERRAL_COOKIE = 'em_ref';
export const REFERRAL_PARAM = 'ref';
/** How long a partner's link keeps credit for a visitor who hasn't signed up yet. */
export const REFERRAL_COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

// Generated codes are 8 characters; partners may be given a custom 4–20 character one.
const CODE_PATTERN = /^[A-Z0-9]{4,20}$/u;

/** Returns the code in canonical form, or null if it isn't a valid referral code. */
export function normaliseReferralCode(value: string | null | undefined): string | null {
  const code = value?.trim().toUpperCase() ?? '';
  return CODE_PATTERN.test(code) ? code : null;
}

/** The link partners share: sign-up page with their code. */
export function referralLink(origin: string, code: string): string {
  return `${origin.replace(/\/+$/u, '')}/sign-up?${REFERRAL_PARAM}=${encodeURIComponent(code)}`;
}
