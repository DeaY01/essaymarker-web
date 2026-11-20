import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { BuyUnitsButton } from "@/components/billing/buy-units";
import { ArrowRightIcon, ChevronRightIcon, CoinsIcon, PenIcon } from "@/components/icons";
import { getAccountSummary } from "@/lib/account";
import type { AccountSummary } from "@/lib/billing";
import { formatMarkedDate } from "@/lib/format";
import { listEvaluations, type SavedReportSummary } from "@/lib/essay-history";
import { getPerformanceBand, MAXIMUM_SCORE } from "@/lib/essay-rules";

export const metadata: Metadata = { title: "My essays" };

function Stats({ reports }: { reports: SavedReportSummary[] }) {
  const average = reports.reduce((sum, report) => sum + report.totalScore, 0) / reports.length;
  const best = Math.max(...reports.map((report) => report.totalScore));
  const latest = reports[0].totalScore;
  const items = [
    { label: "Essays marked", value: String(reports.length) },
    { label: "Average score", value: `${average.toFixed(1)} / ${MAXIMUM_SCORE}` },
    { label: "Best score", value: `${best} / ${MAXIMUM_SCORE}` },
    { label: "Latest score", value: `${latest} / ${MAXIMUM_SCORE}` },
  ];

  return (
    <dl className="stat-grid">
      {items.map((item) => (
        <div className="card stat-card" key={item.label}>
          <dt>{item.label}</dt>
          <dd>{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function ReportRow({ report }: { report: SavedReportSummary }) {
  const band = getPerformanceBand(report.totalScore, MAXIMUM_SCORE);
  return (
    <li>
      <Link className="history-row" href={`/history/${report.id}`}>
        <span className={`history-score tone-${band.tone}`}>
          <strong>{report.totalScore}</strong>
          <span>/ {MAXIMUM_SCORE}</span>
        </span>
        <span className="history-main">
          <span className="history-topic">{report.topic || "No topic given"}</span>
          <span className="history-meta">
            {formatMarkedDate(report.createdAt)} · {report.wordCount} words ·{" "}
            {report.pageCount} {report.pageCount === 1 ? "page" : "pages"}
          </span>
        </span>
        <span className={`band tone-${band.tone} history-band`}>{band.label}</span>
        <ChevronRightIcon className="history-chevron" />
      </Link>
    </li>
  );
}

function UnitsBanner({ account }: { account: AccountSummary }) {
  const { credits } = account;
  return (
    <div className="card units-banner">
      <span className="units-banner-icon" aria-hidden="true">
        <CoinsIcon size={20} />
      </span>
      <div className="units-banner-main">
        <strong>
          {credits} {credits === 1 ? "unit" : "units"} left
        </strong>
        <span>
          {account.isActivated
            ? "Paid account. 1 unit marks 1 essay."
            : "Free account. 1 unit marks 1 essay."}
        </span>
      </div>
      <BuyUnitsButton />
    </div>
  );
}

async function History() {
  await connection();
  const [reports, account] = await Promise.all([listEvaluations(), getAccountSummary()]);
  const unitsBanner = account ? <UnitsBanner account={account} /> : null;

  if (reports.length === 0) {
    return (
      <>
        {unitsBanner}
        <div className="card empty-history">
          <span className="dropzone-icon" aria-hidden="true">
            <PenIcon size={20} />
          </span>
          <h2>No essays yet</h2>
          <p>Your marked essays will appear here, so you can track your progress.</p>
          <Link className="button button-primary" href="/">
            Mark your first essay
            <ArrowRightIcon />
          </Link>
        </div>
      </>
    );
  }

  return (
    <>
      {unitsBanner}
      <Stats reports={reports} />
      <ul className="card history-list" aria-label="Marked essays">
        {reports.map((report) => (
          <ReportRow key={report.id} report={report} />
        ))}
      </ul>
    </>
  );
}

function HistorySkeleton() {
  return (
    <div aria-hidden="true">
      <div className="stat-grid">
        {[0, 1, 2, 3].map((key) => (
          <div className="card stat-card skeleton" key={key} style={{ height: 82 }} />
        ))}
      </div>
      <div className="card skeleton" style={{ height: 240 }} />
    </div>
  );
}

export default function HistoryPage() {
  return (
    <main className="container">
      <div className="page-heading">
        <h1>My essays</h1>
        <p>Every essay you’ve had marked, newest first. Open one to see the full report.</p>
      </div>
      <Suspense fallback={<HistorySkeleton />}>
        <History />
      </Suspense>
    </main>
  );
}
