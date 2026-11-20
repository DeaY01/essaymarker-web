import 'server-only';

import { createHmac, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';

const PAYSTACK_API = 'https://api.paystack.co';

export class PaystackNotConfiguredError extends Error {
  constructor() {
    super('PAYSTACK_SECRET_KEY must be set to take payments.');
    this.name = 'PaystackNotConfiguredError';
  }
}

function secretKey(): string {
  const key = process.env.PAYSTACK_SECRET_KEY?.trim();
  if (!key) throw new PaystackNotConfiguredError();
  return key;
}

const transactionSchema = z.object({
  id: z.number(),
  status: z.string(),
  reference: z.string(),
  amount: z.number(),
  currency: z.string(),
  paid_at: z.string().nullable().optional(),
});

export type PaystackTransaction = z.infer<typeof transactionSchema>;

async function paystackRequest(path: string, init: RequestInit = {}): Promise<unknown> {
  const response = await fetch(`${PAYSTACK_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${secretKey()}`,
      'Content-Type': 'application/json',
      ...init.headers,
    },
    signal: AbortSignal.timeout(15_000),
    cache: 'no-store',
  });
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      typeof body === 'object' && body !== null && 'message' in body ? String(body.message) : '';
    throw new Error(`Paystack ${path} failed (${response.status}) ${message}`.trim());
  }
  return body;
}

/** Starts a checkout. Returns the Paystack page to send the student to. */
export async function initializeTransaction(params: {
  email: string;
  amountKobo: number;
  reference: string;
  callbackUrl: string;
  metadata: Record<string, string | number>;
}): Promise<string> {
  const body = await paystackRequest('/transaction/initialize', {
    method: 'POST',
    body: JSON.stringify({
      email: params.email,
      amount: params.amountKobo,
      currency: 'NGN',
      reference: params.reference,
      callback_url: params.callbackUrl,
      metadata: params.metadata,
    }),
  });
  const parsed = z
    .object({ data: z.object({ authorization_url: z.url() }) })
    .parse(body);
  return parsed.data.authorization_url;
}

/** Asks Paystack for a transaction's real status (never trust the browser). */
export async function verifyTransaction(reference: string): Promise<PaystackTransaction> {
  const body = await paystackRequest(`/transaction/verify/${encodeURIComponent(reference)}`);
  return z.object({ data: transactionSchema }).parse(body).data;
}

/** Checks the `x-paystack-signature` header: HMAC-SHA512 of the raw body with the secret key. */
export function isValidWebhookSignature(rawBody: string, signature: string | null): boolean {
  if (!signature) return false;
  const expected = createHmac('sha512', secretKey()).update(rawBody).digest('hex');
  const given = Buffer.from(signature, 'utf8');
  const wanted = Buffer.from(expected, 'utf8');
  return given.length === wanted.length && timingSafeEqual(given, wanted);
}

export { transactionSchema as paystackTransactionSchema };
