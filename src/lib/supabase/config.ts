// Supabase project settings. Both values are safe to expose to the browser:
// the publishable (anon) key only grants what Row Level Security allows.

export interface SupabaseConfig {
  url: string;
  publishableKey: string;
}

export function getSupabaseConfig(): SupabaseConfig | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const publishableKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ||
    // Older projects call this the anon key.
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

  return url && publishableKey ? { url, publishableKey } : null;
}

export const SUPABASE_NOT_CONFIGURED =
  "Accounts aren’t set up yet. Add the Supabase settings to .env.local and restart the server.";
