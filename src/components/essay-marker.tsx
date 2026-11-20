"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { MarkedEssayResponse } from "@/lib/ai/evaluate-essay";
import { useBuyUnits } from "@/components/billing/buy-units";
import { EssayForm } from "@/components/essay-form";
import { EvaluationReport, ReportSkeleton } from "@/components/evaluation-report";
import { EditIcon, PlusIcon } from "@/components/icons";
import { MarkingScheme } from "@/components/marking-scheme";
import { useEssayPages } from "@/components/use-essay-pages";

const GENERIC_ERROR = "Something went wrong while marking. Please try again.";

interface MarkedEssay {
  evaluation: MarkedEssayResponse;
  topic: string;
  markedAt: Date;
}

function getErrorMessage(result: unknown): string {
  return typeof result === "object" &&
    result !== null &&
    "error" in result &&
    typeof result.error === "string"
    ? result.error
    : GENERIC_ERROR;
}

export type AuthStatus = "checking" | "signed-in" | "signed-out";

export function EssayMarker({
  authStatus,
  credits: initialCredits = null,
}: {
  authStatus: AuthStatus;
  /** Units left, or null while unknown. */
  credits?: number | null;
}) {
  const router = useRouter();
  const { open: openBuyUnits } = useBuyUnits();
  const [credits, setCredits] = useState<number | null>(initialCredits);
  const [topic, setTopic] = useState("");
  const { pages, addFiles, rotate, move, remove, clear } = useEssayPages();
  const [result, setResult] = useState<MarkedEssay | null>(null);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const reportRef = useRef<HTMLElement>(null);

  // Cancel any in-flight evaluation when the page unmounts.
  useEffect(() => () => abortControllerRef.current?.abort(), []);

  // Bring a fresh report into view and move focus to it for screen readers.
  useEffect(() => {
    if (!result) return;
    reportRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    reportRef.current?.focus({ preventScroll: true });
  }, [result]);

  async function handleSubmit() {
    if (isSubmitting || authStatus !== "signed-in") return;
    if (credits === 0) {
      openBuyUnits("You’ve used all your units. Buy more to keep getting your essays marked.");
      return;
    }
    const readyPages = pages.filter((page) => page.status === "ready" && page.blob);
    if (readyPages.length === 0 || readyPages.length !== pages.length) return;

    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;
    const submittedTopic = topic;

    const body = new FormData();
    body.append("topic", topic);
    readyPages.forEach((page, index) => {
      body.append("pages", page.blob!, `page-${index + 1}.jpg`);
    });

    setError("");
    setResult(null);
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/evaluate", {
        method: "POST",
        body,
        signal: controller.signal,
      });

      // Error pages from proxies or the platform may not be JSON.
      let payload: unknown = null;
      try {
        payload = await response.json();
      } catch {
        // Fall through with a null payload.
      }

      if (response.status === 402) {
        setCredits(0);
        openBuyUnits("You’ve used all your units. Buy more to keep getting your essays marked.");
        throw new Error(getErrorMessage(payload));
      }
      if (!response.ok || payload === null) {
        throw new Error(getErrorMessage(payload));
      }

      const marked = payload as MarkedEssayResponse;
      if (marked.creditsRemaining !== null) setCredits(marked.creditsRemaining);
      // Refresh server-rendered parts, like the unit balance in the header.
      router.refresh();

      setResult({
        evaluation: marked,
        topic: submittedTopic,
        markedAt: new Date(),
      });
    } catch (submitError) {
      if (controller.signal.aborted) return;
      setError(
        submitError instanceof TypeError
          ? "We couldn’t reach the server. Check your connection and try again."
          : submitError instanceof Error
            ? submitError.message
            : GENERIC_ERROR,
      );
    } finally {
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
        setIsSubmitting(false);
      }
    }
  }

  function focusPages() {
    const form = document.getElementById("form-title");
    form?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function handleClear() {
    const hasWork = topic.trim() || pages.length > 0;
    if (hasWork && !window.confirm("Remove the topic and all photos? This can’t be undone.")) {
      return;
    }
    setTopic("");
    clear();
    setError("");
    setResult(null);
    document.getElementById("topic")?.focus();
  }

  return (
    <>
      <div className="workspace">
        <EssayForm
          topic={topic}
          pages={pages}
          error={error}
          isSubmitting={isSubmitting}
          authStatus={authStatus}
          credits={credits}
          onTopicChange={setTopic}
          onAddFiles={addFiles}
          onRotatePage={rotate}
          onMovePage={move}
          onRemovePage={remove}
          onSubmit={handleSubmit}
          onClear={handleClear}
        />
        <MarkingScheme />
      </div>

      {isSubmitting && <ReportSkeleton />}
      {result && (
        <EvaluationReport
          ref={reportRef}
          evaluation={result.evaluation}
          topic={result.topic}
          markedAt={result.markedAt}
          status={
            result.evaluation.savedReportId ? (
              <>
                Saved to{" "}
                <Link
                  className="text-link"
                  href={`/history/${result.evaluation.savedReportId}`}
                >
                  My essays
                </Link>
              </>
            ) : (
              <span className="report-status-warning">
                This report couldn’t be saved to My essays. Print it or save it as a
                PDF to keep a copy.
              </span>
            )
          }
          actions={
            <>
              <button
                type="button"
                className="button button-secondary button-sm"
                onClick={focusPages}
              >
                <EditIcon size={14} />
                Change photos
              </button>
              <button
                type="button"
                className="button button-primary button-sm"
                onClick={handleClear}
              >
                <PlusIcon size={14} />
                New essay
              </button>
            </>
          }
        />
      )}
    </>
  );
}
