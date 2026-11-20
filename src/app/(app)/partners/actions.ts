'use server';

import { refresh } from 'next/cache';
import { after } from 'next/server';
import { z } from 'zod';

import { getCurrentUser, type CurrentUser } from '@/lib/auth';
import { formatNaira, koboToNaira } from '@/lib/billing';
import { escapeHtml, sendBrevoEmail } from '@/lib/brevo';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export interface PayoutState {
  status: 'idle' | 'error' | 'submitted';
  message?: string;
  fieldErrors?: Partial<Record<'bankName' | 'accountNumber' | 'accountName', string>>;
  values?: { bankName?: string; accountNumber?: string; accountName?: string };
}

const payoutSchema = z.object({
  bankName: z.string().trim().min(2, 'Enter your bank’s name.').max(100),
  accountNumber: z
    .string()
    .trim()
    .regex(/^[0-9]{10}$/u, 'Enter your 10-digit NUBAN account number.'),
  accountName: z.string().trim().min(2, 'Enter the name on the account.').max(100),
});

/**
 * Asks for the partner's whole available balance to be paid out. The amount is
 * calculated by the database, never taken from this form.
 */
export async function requestPayout(_previous: PayoutState, formData: FormData): Promise<PayoutState> {
  const values = {
    bankName: String(formData.get('bankName') ?? ''),
    accountNumber: String(formData.get('accountNumber') ?? ''),
    accountName: String(formData.get('accountName') ?? ''),
  };

  // Server Actions are public endpoints: re-check the session here.
  const user = await getCurrentUser();
  if (!user) return { status: 'error', message: 'Please sign in again to continue.', values };

  const parsed = payoutSchema.safeParse(values);
  if (!parsed.success) {
    const fieldErrors: PayoutState['fieldErrors'] = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[0] as keyof NonNullable<PayoutState['fieldErrors']>;
      fieldErrors[field] ??= issue.message;
    }
    return { status: 'error', fieldErrors, values };
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) return { status: 'error', message: 'Payouts aren’t available right now.', values };

  const { data: payoutId, error } = await supabase.rpc('request_payout', {
    p_bank_name: parsed.data.bankName,
    p_account_number: parsed.data.accountNumber,
    p_account_name: parsed.data.accountName,
  });

  if (error) {
    const message = error.message.includes('Not a partner')
      ? 'Payouts are only available to approved partners.'
      : error.message.includes('already pending')
      ? 'You already have a payout request being processed.'
      : error.message.includes('minimum payout')
        ? 'You need at least ₦1,000 available to request a payout.'
        : 'We couldn’t send your request. Please try again.';
    if (!/Not a partner|already pending|minimum payout/u.test(error.message)) {
      console.error('Payout request failed:', error.message);
    }
    return { status: 'error', message, values };
  }

  // Tell the admin, after the response so the partner isn't kept waiting.
  const { data: payout } = await supabase
    .from('payout_requests')
    .select('id, amount_kobo, created_at')
    .eq('id', payoutId as string)
    .maybeSingle();
  if (payout) {
    after(() => notifyAdminOfPayout(user, parsed.data, payout as PayoutRow));
  }

  // Re-render the dashboard so the balance and payout status update.
  refresh();
  return {
    status: 'submitted',
    message: 'Payout requested. We’ll send the money to your account, usually within 3 working days.',
  };
}

interface PayoutRow {
  id: string;
  amount_kobo: number;
  created_at: string;
}

/** Emails the admin the details needed to pay a new payout request. */
async function notifyAdminOfPayout(
  user: CurrentUser,
  bank: z.infer<typeof payoutSchema>,
  payout: PayoutRow,
): Promise<void> {
  const to = process.env.PAYOUT_NOTIFY_EMAIL?.trim();
  if (!to) {
    console.warn('Payout notification not sent: PAYOUT_NOTIFY_EMAIL is not set.');
    return;
  }

  const amount = formatNaira(koboToNaira(payout.amount_kobo));
  const partner = user.fullName ? `${user.fullName} (${user.email})` : user.email;
  const rows: [string, string][] = [
    ['Partner', partner],
    ['Amount', amount],
    ['Bank', bank.bankName],
    ['Account number', bank.accountNumber],
    ['Account name', bank.accountName],
    ['Requested', new Date(payout.created_at).toLocaleString('en-NG', { timeZone: 'Africa/Lagos' })],
    ['Payout ID', payout.id],
  ];
  const markPaid = `select public.mark_payout_paid('${payout.id}');`;

  await sendBrevoEmail({
    to,
    subject: `Payout request: ${amount} to ${user.fullName || user.email}`,
    text: [
      'A partner has requested a payout.',
      '',
      ...rows.map(([label, value]) => `${label}: ${value}`),
      '',
      'After sending the money, run this in the Supabase SQL Editor:',
      markPaid,
    ].join('\n'),
    html: `
      <p>A partner has requested a payout.</p>
      <table cellpadding="6" style="border-collapse:collapse">
        ${rows
          .map(
            ([label, value]) =>
              `<tr><td style="color:#6b7a73">${escapeHtml(label)}</td><td><strong>${escapeHtml(value)}</strong></td></tr>`,
          )
          .join('')}
      </table>
      <p>After sending the money, run this in the Supabase SQL Editor:</p>
      <pre style="background:#f5f7f6;padding:10px">${escapeHtml(markPaid)}</pre>
    `,
  });
}
