import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { CopyButton } from "@/components/copy-button";
import { AlertIcon } from "@/components/icons";
import { PayoutForm } from "@/components/partners/payout-form";
import { getAccountSummary } from "@/lib/account";
import {
  getAffiliateSummary,
  listPayouts,
  listRecentCommissions,
  type Payout,
} from "@/lib/affiliate";
import {
  COMMISSION_RATE,
  formatNaira,
  koboToNaira,
  MIN_PAYOUT_NAIRA,
  UNIT_PACK,
} from "@/lib/billing";
import { formatMarkedDate } from "@/lib/format";
import { referralLink } from "@/lib/referral";
import { getSiteOrigin } from "@/lib/site-url";

export const metadata: Metadata = { title: "Partner programme" };

const COMMISSION_NAIRA = UNIT_PACK.priceNaira * COMMISSION_RATE;

const PAYOUT_STATUS: Record<Payout["status"], { label: string; tone: string }> = {
  pending: { label: "Processing", tone: "fair" },
  paid: { label: "Paid", tone: "strong" },
  rejected: { label: "Declined", tone: "weak" },
};

async function PartnerDashboard() {
  await connection();
  // Partners are approved manually (profiles.is_partner); everyone else goes home.
  const account = await getAccountSummary();
  if (!account?.isPartner) redirect("/");

  const [summary, commissions, payouts, origin] = await Promise.all([
    getAffiliateSummary(),
    listRecentCommissions(),
    listPayouts(),
    getSiteOrigin(),
  ]);

  if (!summary) {
    return (
      <div className="alert tone-weak" role="alert" style={{ marginTop: 24 }}>
        <AlertIcon />
        <p>Your partner dashboard couldn’t be loaded. Please try again later.</p>
      </div>
    );
  }

  const link = referralLink(origin, summary.referralCode);
  const availableNaira = koboToNaira(summary.availableKobo);
  const hasPendingPayout = summary.pendingPayoutKobo > 0;
  const shareText = `Get your WAEC/NECO essays marked like a real examiner on EssayMarker. Sign up with my link: ${link}`;

  const stats = [
    { label: "Students referred", value: String(summary.referralsCount) },
    { label: "Student purchases", value: String(summary.purchasesCount) },
    { label: "Total earned", value: formatNaira(koboToNaira(summary.totalEarnedKobo)) },
    { label: "Available to withdraw", value: formatNaira(availableNaira) },
  ];

  return (
    <>
      <div className="page-heading">
        <h1>Partner programme</h1>
        <p>
          Invite students to EssayMarker and earn {COMMISSION_RATE * 100}% of
          every unit purchase they make.
        </p>
      </div>
      <section className="card referral-card" aria-labelledby="referral-title">
        <div className="card-header">
          <div>
            <h2 className="card-title" id="referral-title">
              Your referral link
            </h2>
            <p className="card-subtitle">
              Share it with students. You earn {formatNaira(COMMISSION_NAIRA)} (
              {COMMISSION_RATE * 100}%) every time someone who signed up with it
              buys units.
            </p>
          </div>
        </div>
        <div className="card-body">
          <div className="referral-link-row">
            <code className="referral-link">{link}</code>
            <CopyButton value={link} label="referral link" showText />
          </div>
          <div className="referral-actions">
            <span className="referral-code">
              Code <strong>{summary.referralCode}</strong>
            </span>
            <a
              className="button button-secondary button-sm"
              href={`https://wa.me/?text=${encodeURIComponent(shareText)}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              Share on WhatsApp
            </a>
          </div>
        </div>
      </section>

      <dl className="stat-grid" style={{ marginTop: 16 }}>
        {stats.map((item) => (
          <div className="card stat-card" key={item.label}>
            <dt>{item.label}</dt>
            <dd>{item.value}</dd>
          </div>
        ))}
      </dl>

      <div className="report-columns" style={{ marginTop: 0 }}>
        <section className="card" aria-labelledby="payout-title">
          <div className="card-header">
            <div>
              <h2 className="card-title" id="payout-title">
                Withdraw earnings
              </h2>
              <p className="card-subtitle">
                Minimum {formatNaira(MIN_PAYOUT_NAIRA)}. Paid to a Nigerian bank
                account, usually within 3 working days.
              </p>
            </div>
          </div>
          <div className="card-body">
            {hasPendingPayout ? (
              <p className="empty-state">
                Your payout of {formatNaira(koboToNaira(summary.pendingPayoutKobo))} is
                being processed. You can request another once it’s paid.
              </p>
            ) : availableNaira >= MIN_PAYOUT_NAIRA ? (
              <PayoutForm availableNaira={availableNaira} />
            ) : (
              <p className="empty-state">
                You can withdraw once you have {formatNaira(MIN_PAYOUT_NAIRA)} available
                ({formatNaira(MIN_PAYOUT_NAIRA - availableNaira)} to go).
              </p>
            )}

            {payouts.length > 0 && (
              <ul className="ledger">
                {payouts.map((payout) => {
                  const status = PAYOUT_STATUS[payout.status];
                  return (
                    <li key={payout.id}>
                      <span>
                        <strong>{formatNaira(koboToNaira(payout.amountKobo))}</strong>
                        <span className="ledger-meta">
                          {formatMarkedDate(payout.createdAt)} · {payout.bankName} ••••
                          {payout.accountNumberLast4}
                        </span>
                      </span>
                      <span className={`status-pill tone-${status.tone}`}>{status.label}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </section>

        <section className="card" aria-labelledby="earnings-title">
          <div className="card-header">
            <div>
              <h2 className="card-title" id="earnings-title">
                Recent earnings
              </h2>
              <p className="card-subtitle">One entry per purchase by a student you referred</p>
            </div>
          </div>
          <div className="card-body">
            {commissions.length === 0 ? (
              <p className="empty-state">
                No earnings yet. Share your link with students to get started.
              </p>
            ) : (
              <ul className="ledger">
                {commissions.map((commission) => (
                  <li key={commission.id}>
                    <span>
                      <strong>+{formatNaira(koboToNaira(commission.amountKobo))}</strong>
                      <span className="ledger-meta">
                        {formatMarkedDate(commission.createdAt)} · Student purchase
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>
    </>
  );
}

function DashboardSkeleton() {
  return (
    <div aria-hidden="true" style={{ paddingTop: 40 }}>
      <div className="card skeleton" style={{ height: 150 }} />
      <div className="stat-grid" style={{ marginTop: 16 }}>
        {[0, 1, 2, 3].map((key) => (
          <div className="card stat-card skeleton" key={key} style={{ height: 82 }} />
        ))}
      </div>
    </div>
  );
}

export default function PartnersPage() {
  return (
    <main className="container">
      {/* Everything, heading included, waits for the partner check so
          non-partners are redirected without seeing the page. */}
      <Suspense fallback={<DashboardSkeleton />}>
        <PartnerDashboard />
      </Suspense>
    </main>
  );
}
