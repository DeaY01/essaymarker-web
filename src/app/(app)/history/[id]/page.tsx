import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { DeleteReportButton } from "@/components/delete-report-button";
import { EvaluationReport } from "@/components/evaluation-report";
import { ChevronLeftIcon } from "@/components/icons";
import { getEvaluation } from "@/lib/essay-history";

export const metadata: Metadata = { title: "Essay report" };

async function SavedReportView({ params }: { params: Promise<{ id: string }> }) {
  await connection();
  const { id } = await params;
  const saved = await getEvaluation(id);
  if (!saved) notFound();

  return (
    <EvaluationReport
      evaluation={saved.report}
      topic={saved.topic}
      markedAt={saved.createdAt}
      actions={<DeleteReportButton id={saved.id} />}
    />
  );
}

export default function SavedReportPage({ params }: PageProps<"/history/[id]">) {
  return (
    <main className="container">
      <nav className="back-nav" aria-label="Breadcrumb">
        <Link className="text-link back-link" href="/history">
          <ChevronLeftIcon size={16} />
          My essays
        </Link>
      </nav>
      <Suspense fallback={<div className="card skeleton" style={{ height: 420, marginTop: 32 }} aria-hidden="true" />}>
        <SavedReportView params={params} />
      </Suspense>
    </main>
  );
}
