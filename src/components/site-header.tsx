import Image from "next/image";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense, type ReactNode } from "react";
import { ActiveNavLinks, NavLinks } from "@/components/site-nav";
import { getAccountSummary } from "@/lib/account";

/** Reads the session (to know whether to show Earn), so it renders inside <Suspense>. */
async function MainNav() {
  await connection();
  const account = await getAccountSummary();
  return <ActiveNavLinks showEarn={account?.isPartner ?? false} />;
}

/** `account` is rendered by the server (it reads the session) and passed in. */
export function SiteHeader({ account }: { account: ReactNode }) {
  return (
    <header className="site-header">
      <div className="container">
        <div className="header-start">
          <Link className="brand" href="/" aria-label="EssayMarker home">
            <Image className="brand-logo" src="/logo.png" alt="" width={34} height={34} priority />
            <span className="brand-name">EssayMarker</span>
          </Link>
          {/* The current-page highlight and the partner-only Earn link stream in per request. */}
          <Suspense fallback={<NavLinks pathname={null} />}>
            <MainNav />
          </Suspense>
        </div>
        <div className="header-end">
          <span className="badge header-badge">
            <span className="badge-dot" aria-hidden="true" />
            WAEC &amp; NECO
          </span>
          {account}
        </div>
      </div>
    </header>
  );
}
