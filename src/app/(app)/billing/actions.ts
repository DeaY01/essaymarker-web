'use server';

import { redirect } from 'next/navigation';

import { getCurrentUser } from '@/lib/auth';
import { UNIT_PACK } from '@/lib/billing';
import { createPendingPayment, PACK_AMOUNT_KOBO } from '@/lib/payments';
import { initializeTransaction, PaystackNotConfiguredError } from '@/lib/paystack';
import { getSiteOrigin } from '@/lib/site-url';

export interface CheckoutState {
  error?: string;
}

/**
 * Starts a Paystack checkout for the standard pack and sends the student to
 * Paystack's payment page. The amount is fixed here on the server.
 */
export async function startCheckout(): Promise<CheckoutState> {
  // Server Actions are public endpoints: re-check the session here.
  const user = await getCurrentUser();
  if (!user) redirect('/sign-in');
  if (!user.email) return { error: 'Your account needs an email address to pay.' };

  let authorizationUrl: string;
  try {
    const reference = await createPendingPayment(user.id);
    const origin = await getSiteOrigin();
    authorizationUrl = await initializeTransaction({
      email: user.email,
      amountKobo: PACK_AMOUNT_KOBO,
      reference,
      callbackUrl: `${origin}/billing/callback`,
      metadata: { user_id: user.id, units: UNIT_PACK.units },
    });
  } catch (error) {
    if (error instanceof PaystackNotConfiguredError) {
      console.error(error.message);
      return { error: 'Payments aren’t set up yet. Please try again later.' };
    }
    console.error('Could not start Paystack checkout:', error);
    return { error: 'We couldn’t start the payment. Please try again.' };
  }

  // Outside the try block: redirect() works by throwing.
  redirect(authorizationUrl);
}
