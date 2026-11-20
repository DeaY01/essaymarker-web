import 'server-only';

import { createSupabaseServerClient } from '@/lib/supabase/server';

// All reads use the partner's own session; the database only returns their
// own figures (RLS and the affiliate_summary() function enforce this).

export interface AffiliateSummary {
  referralCode: string;
  referralsCount: number;
  purchasesCount: number;
  totalEarnedKobo: number;
  paidOutKobo: number;
  pendingPayoutKobo: number;
  availableKobo: number;
}

export interface Commission {
  id: string;
  amountKobo: number;
  createdAt: string;
}

export interface Payout {
  id: string;
  amountKobo: number;
  status: 'pending' | 'paid' | 'rejected';
  bankName: string;
  accountNumberLast4: string;
  createdAt: string;
  processedAt: string | null;
}

export async function getAffiliateSummary(): Promise<AffiliateSummary | null> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;

  const { data, error } = await supabase.rpc('affiliate_summary').maybeSingle();
  if (error) {
    console.error('Failed to load affiliate summary:', error.message);
    return null;
  }
  if (!data) return null;

  const row = data as Record<string, string | number>;
  return {
    referralCode: String(row.referral_code),
    referralsCount: Number(row.referrals_count),
    purchasesCount: Number(row.purchases_count),
    totalEarnedKobo: Number(row.total_earned_kobo),
    paidOutKobo: Number(row.paid_out_kobo),
    pendingPayoutKobo: Number(row.pending_payout_kobo),
    availableKobo: Number(row.available_kobo),
  };
}

export async function listRecentCommissions(limit = 20): Promise<Commission[]> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('affiliate_commissions')
    .select('id, amount_kobo, created_at')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) {
    console.error('Failed to load commissions:', error.message);
    return [];
  }
  return (data as { id: string; amount_kobo: number; created_at: string }[]).map((row) => ({
    id: row.id,
    amountKobo: row.amount_kobo,
    createdAt: row.created_at,
  }));
}

export async function listPayouts(limit = 10): Promise<Payout[]> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('payout_requests')
    .select('id, amount_kobo, status, bank_name, account_number, created_at, processed_at')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) {
    console.error('Failed to load payouts:', error.message);
    return [];
  }
  type Row = {
    id: string;
    amount_kobo: number;
    status: Payout['status'];
    bank_name: string;
    account_number: string;
    created_at: string;
    processed_at: string | null;
  };
  return (data as Row[]).map((row) => ({
    id: row.id,
    amountKobo: row.amount_kobo,
    status: row.status,
    bankName: row.bank_name,
    // Only the last digits are needed to recognise the account.
    accountNumberLast4: row.account_number.slice(-4),
    createdAt: row.created_at,
    processedAt: row.processed_at,
  }));
}
