import 'server-only';

import { randomUUID } from 'node:crypto';

import { UNIT_PACK } from '@/lib/billing';
import type { PaystackTransaction } from '@/lib/paystack';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

export const PACK_AMOUNT_KOBO = UNIT_PACK.priceNaira * 100;

export type PaymentOutcome = 'credited' | 'already-credited' | 'pending' | 'failed';

function adminOrThrow() {
  const admin = createSupabaseAdminClient();
  if (!admin) throw new Error('SUPABASE_SECRET_KEY must be set to record payments.');
  return admin;
}

/** Records a pending payment for the standard pack and returns its reference. */
export async function createPendingPayment(userId: string): Promise<string> {
  const reference = `em_${randomUUID().replace(/-/gu, '')}`;
  const { error } = await adminOrThrow().from('payments').insert({
    user_id: userId,
    reference,
    amount_kobo: PACK_AMOUNT_KOBO,
    units: UNIT_PACK.units,
  });
  if (error) throw new Error(`Could not record payment: ${error.message}`);
  return reference;
}

/**
 * Applies a Paystack transaction that Paystack itself reported (via the signed
 * webhook or the verify API). Credits units and the referrer's commission
 * exactly once, however many times it's called.
 */
export async function applyPaystackTransaction(transaction: PaystackTransaction): Promise<PaymentOutcome> {
  const admin = adminOrThrow();

  if (transaction.status !== 'success') {
    if (transaction.status === 'failed' || transaction.status === 'abandoned') {
      await admin
        .from('payments')
        .update({ status: 'failed' })
        .eq('reference', transaction.reference)
        .eq('status', 'pending');
      return 'failed';
    }
    return 'pending';
  }

  if (transaction.currency !== 'NGN') {
    console.error(`Ignoring payment ${transaction.reference}: unexpected currency ${transaction.currency}`);
    return 'failed';
  }

  const { data, error } = await admin.rpc('complete_payment', {
    p_reference: transaction.reference,
    p_amount_kobo: transaction.amount,
    p_paystack_transaction_id: transaction.id,
    p_paid_at: transaction.paid_at ?? null,
  });
  if (error) throw new Error(`Could not complete payment: ${error.message}`);
  if (data === true) return 'credited';

  // Not completed by this call: either done already, or the amount/reference
  // didn't match a pending payment of ours.
  const { data: existing } = await admin
    .from('payments')
    .select('status, amount_kobo')
    .eq('reference', transaction.reference)
    .maybeSingle();
  if (existing?.status === 'success') return 'already-credited';
  console.error(
    `Payment ${transaction.reference} could not be credited (amount ${transaction.amount}, stored ${existing?.amount_kobo ?? 'none'}).`,
  );
  return 'failed';
}

/** Whether the given payment belongs to this user (for the return page). */
export async function paymentBelongsTo(reference: string, userId: string): Promise<boolean> {
  const { data } = await adminOrThrow()
    .from('payments')
    .select('user_id')
    .eq('reference', reference)
    .maybeSingle();
  return data?.user_id === userId;
}
