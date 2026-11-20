import 'server-only';

import { headers } from 'next/headers';

/** The site's public origin, used in email links and payment return URLs. */
export async function getSiteOrigin(): Promise<string> {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (configured) return configured.replace(/\/+$/u, '');
  const requestHeaders = await headers();
  const origin = requestHeaders.get('origin');
  if (origin) return origin;
  const host = requestHeaders.get('host') ?? 'localhost:3000';
  const protocol = requestHeaders.get('x-forwarded-proto') ?? 'http';
  return `${protocol}://${host}`;
}
