import { Suspense } from "react";
import { AccountMenu, AccountMenuSkeleton } from "@/components/account-menu";
import { BuyUnitsProvider } from "@/components/billing/buy-units";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

/** Chrome for the signed-in app. Signed-out visitors are sent to /sign-in by the proxy. */
export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <BuyUnitsProvider>
      <SiteHeader
        account={
          <Suspense fallback={<AccountMenuSkeleton />}>
            <AccountMenu />
          </Suspense>
        }
      />
      {children}
      <SiteFooter />
    </BuyUnitsProvider>
  );
}
