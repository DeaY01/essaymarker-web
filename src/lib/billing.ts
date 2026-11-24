// Pricing and partner-programme rules. Client-safe: no secrets here.
// The database functions in supabase/migrations enforce the same numbers.

/** Units given to every new account. */
export const FREE_UNITS = 5;

/** The pack students buy through Paystack. One unit marks one essay. */
export const UNIT_PACK = { units: 60, priceNaira: 3_000 } as const;

/** Share of each referred purchase paid to the referrer. */
export const COMMISSION_RATE = 0.1;

/** Smallest balance a partner can withdraw. */
export const MIN_PAYOUT_NAIRA = 1_000;

export function formatNaira(amount: number): string {
  return `₦${amount.toLocaleString("en-NG", { maximumFractionDigits: 2 })}`;
}

export function koboToNaira(kobo: number): number {
  return kobo / 100;
}

export interface AccountSummary {
  credits: number;
  /** True once any payment has succeeded. */
  isActivated: boolean;
  /** Approved partner (set manually in Supabase): can see Earn and earns commission. */
  isPartner: boolean;
}

/** Protected content is open to students with units or a paid account. */
export function canAccessProtectedContent(account: AccountSummary): boolean {
  return account.credits > 0 || account.isActivated;
}
