import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { AlertIcon, ArrowRightIcon, CheckIcon } from "@/components/icons";
import { getAccountSummary } from "@/lib/account";
import { getCurrentUser } from "@/lib/auth";
import { UNIT_PACK } from "@/lib/billing";
import { applyPaystackTransaction, paymentBelongsTo, type PaymentOutcome } from "@/lib/payments";
import { verifyTransaction } from "@/lib/paystack";

export const metadata: Metadata = { title: "Payment" };

/**
 * Paystack sends the student back here after checkout. The webhook usually
 * credits the units first; this page also checks with Paystack directly, so
 * the units appear even if the webhook is slow or can't reach this server.
 */
async function PaymentResult({ searchParams }: { searchParams: Promise<{ reference?: string; trxref?: string }> }) {
  await connection();
  const params = await searchParams;
  const reference = params.reference ?? params.trxref ?? "";
  const user = await getCurrentUser();

  let outcome: PaymentOutcome | "unknown" = "unknown";
  if (user && /^em_[0-9a-f]{32}$/u.test(reference) && (await paymentBelongsTo(reference, user.id))) {
    try {
      outcome = await applyPaystackTransaction(await verifyTransaction(reference));
    } catch (error) {
      console.error("Payment verification failed:", error);
    }
  }

  const account = await getAccountSummary();
  const credited = outcome === "credited" || outcome === "already-credited";

  return (
    <section className="card locked-card" aria-live="polite">
      <span
        className={credited ? "auth-success-icon" : "locked-icon"}
        aria-hidden="true"
      >
        {credited ? <CheckIcon size={22} /> : <AlertIcon size={22} />}
      </span>
      {credited ? (
        <>
          <h2>Payment successful</h2>
          <p>
            {UNIT_PACK.units} units have been added to your account.
            {account ? ` You now have ${account.credits} units.` : ""}
          </p>
        </>
      ) : outcome === "pending" ? (
        <>
          <h2>Payment processing</h2>
          <p>
            Paystack is still confirming your payment. Your units will be added
            automatically as soon as it’s confirmed; you can refresh this page.
          </p>
        </>
      ) : outcome === "failed" ? (
        <>
          <h2>Payment not completed</h2>
          <p>The payment didn’t go through, and you haven’t been charged units. You can try again.</p>
        </>
      ) : (
        <>
          <h2>We couldn’t confirm this payment</h2>
          <p>
            If money left your account, your units will be added automatically
            once Paystack confirms it. Otherwise, please try again.
          </p>
        </>
      )}
      <Link className="button button-primary" href="/">
        Mark an essay
        <ArrowRightIcon />
      </Link>
    </section>
  );
}

export default function PaymentCallbackPage({ searchParams }: PageProps<"/billing/callback">) {
  return (
    <main className="container" style={{ paddingTop: 40 }}>
      <Suspense
        fallback={
          <section className="card locked-card" aria-busy="true">
            <span className="spinner" aria-hidden="true" style={{ borderColor: "var(--border)", borderTopColor: "var(--brand)" }} />
            <h2>Confirming your payment…</h2>
          </section>
        }
      >
        <PaymentResult searchParams={searchParams as Promise<{ reference?: string; trxref?: string }>} />
      </Suspense>
    </main>
  );
}
