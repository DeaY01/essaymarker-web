import 'server-only';

import { cache } from 'react';

import type { AccountSummary } from '@/lib/billing';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { createSupabaseServerClient } from '@/lib/supabase/server';

/**
 * The signed-in student's unit balance and activation status, read with their
 * own session (RLS limits it to their row). Null if it can't be read.
 * Deduplicated per request, since the header, menu and page all read it.
 */
export const getAccountSummary = cache(async (): Promise<AccountSummary | null> => {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from('profiles')
    .select('credits, activated_at, is_partner')
    .maybeSingle();

  if (error) {
    console.error('Failed to load profile:', error.message);
    return null;
  }

  const profile = data as {
    credits: number;
    activated_at: string | null;
    is_partner: boolean | null;
  } | null;
  return {
    credits: profile?.credits ?? 0,
    isActivated: Boolean(profile?.activated_at),
    isPartner: profile?.is_partner === true,
  };
});

export class BillingNotConfiguredError extends Error {
  constructor() {
    super('SUPABASE_SECRET_KEY (service role) must be set to charge units.');
    this.name = 'BillingNotConfiguredError';
  }
}

/**
 * Takes one unit before marking. Returns the balance left, or null if the
 * student has none. Atomic in the database, so parallel requests can't overspend.
 */
export async function reserveUnit(userId: string): Promise<number | null> {
  const admin = createSupabaseAdminClient();
  if (!admin) throw new BillingNotConfiguredError();

  const { data, error } = await admin.rpc('reserve_credit', { p_user_id: userId });
  if (error) throw new Error(`Could not reserve a unit: ${error.message}`);
  return typeof data === 'number' ? data : null;
}

/** Gives back a unit reserved for a marking that didn't complete. */
export async function refundUnit(userId: string): Promise<void> {
  const admin = createSupabaseAdminClient();
  if (!admin) return;
  const { error } = await admin.rpc('refund_credit', { p_user_id: userId });
  if (error) console.error(`Failed to refund a unit for user ${userId}:`, error.message);
}
