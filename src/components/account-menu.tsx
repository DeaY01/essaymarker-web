import Link from "next/link";
import { connection } from "next/server";
import { signOut } from "@/app/(auth)/actions";
import { AccountDropdown } from "@/components/account-dropdown";
import { BuyUnitsButton } from "@/components/billing/buy-units";
import { getAccountSummary } from "@/lib/account";
import { getCurrentUser } from "@/lib/auth";

function initialsFor(name: string, email: string): string {
  const source = name.trim() || email;
  const parts = source.split(/[\s@._-]+/u).filter(Boolean);
  const letters = parts.length > 1 ? parts[0][0] + parts[1][0] : source.slice(0, 2);
  return letters.toUpperCase();
}

/** Reads the session, so it must render inside a <Suspense> boundary. */
export async function AccountMenu() {
  // Mark this component as request-time before anything touches Supabase.
  // With cacheComponents, use connection() rather than `dynamic = 'force-dynamic'`.
  await connection();

  const user = await getCurrentUser();

  if (!user) {
    return (
      <div className="account-actions">
        <Link className="button button-ghost button-sm" href="/sign-in">
          Sign in
        </Link>
        <Link className="button button-primary button-sm" href="/sign-up">
          Sign up
        </Link>
      </div>
    );
  }

  const account = await getAccountSummary();
  const credits = account?.credits ?? 0;

  return (
    <div className="account-actions">
      {account && (
        <BuyUnitsButton className={`units-pill${credits === 0 ? " is-empty" : ""}`}>
          <span>
            {credits}
            <span className="units-pill-label"> {credits === 1 ? "unit" : "units"}</span>
            <span className="sr-only"> left. Buy more units</span>
          </span>
        </BuyUnitsButton>
      )}
      <BuyUnitsButton className="button button-secondary button-sm buy-units-header">
        Buy units
      </BuyUnitsButton>
      <AccountDropdown
        initials={initialsFor(user.fullName, user.email)}
        name={user.fullName || "Your account"}
        email={user.email}
        isPartner={account?.isPartner ?? false}
        signOutAction={signOut}
      />
    </div>
  );
}

export function AccountMenuSkeleton() {
  return <span className="account-skeleton skeleton" aria-hidden="true" />;
}
