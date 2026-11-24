import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { BuyUnitsButton, OpenBuyUnitsOnMount } from "@/components/billing/buy-units";
import { AlertIcon, BookIcon, LockIcon } from "@/components/icons";
import { PastPaperViewer } from "@/components/past-paper-viewer";
import { getAccountSummary } from "@/lib/account";
import { canAccessProtectedContent, formatNaira, UNIT_PACK } from "@/lib/billing";
import {
  createPaperViewUrl,
  EXAM_BODIES,
  listPastPapers,
  type ExamBody,
} from "@/lib/past-questions";

export const metadata: Metadata = {
  title: "Past questions",
  description: "WAEC and NECO English past question papers.",
};

type SearchParams = Record<string, string | string[] | undefined>;

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function paperHref(body: ExamBody, year?: number): string {
  const params = new URLSearchParams({ body });
  if (year) params.set("year", String(year));
  return `/past-questions?${params}`;
}

async function PastQuestions({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const [papers, params] = await Promise.all([listPastPapers(), searchParams]);

  if (papers.length === 0) {
    return (
      <div className="card empty-history">
        <span className="dropzone-icon" aria-hidden="true">
          <BookIcon size={20} />
        </span>
        <h2>No past questions yet</h2>
        <p>WAEC and NECO papers will appear here as soon as they’re added.</p>
      </div>
    );
  }

  // Pick the requested exam body and year, falling back to what's available.
  const bodies = EXAM_BODIES.filter((body) => papers.some((paper) => paper.examBody === body));
  const requestedBody = firstValue(params.body)?.toUpperCase();
  const body = bodies.find((item) => item === requestedBody) ?? bodies[0];
  const bodyPapers = papers.filter((paper) => paper.examBody === body);
  const requestedYear = Number(firstValue(params.year));
  const paper =
    bodyPapers.find((item) => item.examYear === requestedYear) ?? bodyPapers[0];

  const viewUrl = await createPaperViewUrl(paper.filePath);
  const title = `${paper.examBody} ${paper.examYear} English Language`;

  return (
    <>
      <div className="paper-picker">
        <nav className="exam-tabs" aria-label="Exam body">
          {bodies.map((item) => (
            <Link
              key={item}
              className="exam-tab"
              href={paperHref(item)}
              aria-current={item === body ? "page" : undefined}
              scroll={false}
            >
              {item}
            </Link>
          ))}
        </nav>
        <nav className="topic-nav" aria-label={`${body} years`}>
          {bodyPapers.map((item) => (
            <Link
              key={item.id}
              className="topic-chip"
              href={paperHref(body, item.examYear)}
              aria-current={item.id === paper.id ? "page" : undefined}
              scroll={false}
            >
              {item.examYear}
            </Link>
          ))}
        </nav>
      </div>

      <section className="paper-viewer" aria-label={title}>
        <div className={`paper-viewer-bar exam-${paper.examBody.toLowerCase()}`}>
          <strong>
            {paper.examBody} {paper.examYear}
          </strong>
          <span>View only</span>
        </div>
        {viewUrl ? (
          <PastPaperViewer key={viewUrl} src={viewUrl} title={title} />
        ) : (
          <div className="alert tone-weak" role="alert" style={{ margin: 16 }}>
            <AlertIcon />
            <p>This paper couldn’t be opened. Please refresh the page or try again later.</p>
          </div>
        )}
      </section>

      <p className="learn-disclaimer">
        Papers are provided for exam practice. WAEC and NECO own the copyright
        in their examination papers.
      </p>
    </>
  );
}

const LOCKED_REASON =
  "Past questions are available while you have units or a paid account. Buy units to unlock past questions.";

async function GatedPastQuestions({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await connection();
  const account = await getAccountSummary();

  if (!account || !canAccessProtectedContent(account)) {
    return (
      <div className="card locked-card">
        <OpenBuyUnitsOnMount reason={LOCKED_REASON} />
        <span className="locked-icon" aria-hidden="true">
          <LockIcon size={22} />
        </span>
        <h2>Past questions are locked</h2>
        <p>
          You’ve used your free units. Buy {UNIT_PACK.units} units for{" "}
          {formatNaira(UNIT_PACK.priceNaira)} to unlock past questions and keep
          getting your essays marked.
        </p>
        <BuyUnitsButton className="button button-primary" reason={LOCKED_REASON}>
          Buy units to unlock
        </BuyUnitsButton>
      </div>
    );
  }

  return <PastQuestions searchParams={searchParams} />;
}

function PastQuestionsSkeleton() {
  return (
    <div aria-hidden="true">
      <div className="card skeleton" style={{ height: 40, width: 160, marginBottom: 14 }} />
      <div className="card skeleton" style={{ height: 36, width: 240, marginBottom: 20 }} />
      <div className="card skeleton" style={{ height: 520 }} />
    </div>
  );
}

export default function PastQuestionsPage({ searchParams }: PageProps<"/past-questions">) {
  return (
    <main className="container">
      <div className="page-heading">
        <h1>Past questions</h1>
        <p>
          WAEC and NECO English papers. Choose an exam and year, pick an essay
          question, write your answer by hand, then upload it on Mark essay.
        </p>
      </div>
      <Suspense fallback={<PastQuestionsSkeleton />}>
        <GatedPastQuestions searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
