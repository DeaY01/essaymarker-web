"use client";

import Link from "next/link";
import type { ReactNode, Ref } from "react";
import type { EssayEvaluation, WordCountStatus } from "@/lib/ai/evaluate-essay";
import {
  AlertIcon,
  ArrowRightIcon,
  BookIcon,
  PrinterIcon,
} from "@/components/icons";
import { formatMarkedDate } from "@/lib/format";
import { LEARNING_TOPICS, TOPIC_FOR_RUBRIC_CATEGORY } from "@/lib/learning-videos";
import {
  getPerformanceBand,
  RUBRIC_CATEGORIES,
  type PerformanceTone,
} from "@/lib/essay-rules";

const RING_RADIUS = 70;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

const LENGTH_STATUS: Record<
  WordCountStatus,
  { label: string; tone: PerformanceTone }
> = {
  below_target: { label: "Below target", tone: "weak" },
  within_target: { label: "On target", tone: "strong" },
  above_target: { label: "Above target", tone: "fair" },
};

function ScoreRing({
  score,
  maximum,
}: {
  score: number;
  maximum: number;
}) {
  const ratio = maximum > 0 ? Math.min(score / maximum, 1) : 0;
  return (
    <div
      className="score-ring"
      role="img"
      aria-label={`Total score ${score} out of ${maximum}`}
    >
      <svg viewBox="0 0 160 160">
        <circle
          className="score-ring-track"
          cx="80"
          cy="80"
          r={RING_RADIUS}
          fill="none"
          strokeWidth="12"
        />
        <circle
          className="score-ring-value"
          cx="80"
          cy="80"
          r={RING_RADIUS}
          fill="none"
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={RING_CIRCUMFERENCE}
          strokeDashoffset={RING_CIRCUMFERENCE * (1 - ratio)}
        />
      </svg>
      <div className="score-ring-label" aria-hidden="true">
        <strong>{score}</strong>
        <span>out of {maximum}</span>
      </div>
    </div>
  );
}

interface EvaluationReportProps {
  evaluation: EssayEvaluation;
  topic: string;
  markedAt: Date | string;
  /** Buttons shown next to "Print / PDF", e.g. "New essay". */
  actions?: ReactNode;
  /** A line under the topic, e.g. whether the report was saved. */
  status?: ReactNode;
  ref?: Ref<HTMLElement>;
}

export function EvaluationReport({
  evaluation,
  topic,
  markedAt,
  actions,
  status,
  ref,
}: EvaluationReportProps) {
  const { totalScore, maximumScore, targetWordCount } = evaluation;
  const band = getPerformanceBand(totalScore, maximumScore);
  const lengthStatus = LENGTH_STATUS[targetWordCount.status];
  const percentage = Math.round((totalScore / maximumScore) * 100);

  // Point the student to lessons for their weakest rubric area.
  const weakest = RUBRIC_CATEGORIES.reduce((lowest, category) =>
    evaluation.rubric[category.key].score / category.maximum <
    evaluation.rubric[lowest.key].score / lowest.maximum
      ? category
      : lowest,
  );
  const suggestedTopic = LEARNING_TOPICS.find(
    (topic) => topic.id === TOPIC_FOR_RUBRIC_CATEGORY[weakest.key],
  );

  return (
    <section
      className="report"
      ref={ref}
      tabIndex={-1}
      aria-labelledby="report-title"
    >
      <header className="report-header">
        <div>
          <span className="eyebrow">Marking report</span>
          <h2 id="report-title">Examiner’s assessment</h2>
          <p className="report-topic">
            {topic.trim() ? <>Topic: {topic.trim()}</> : "No topic given"} ·{" "}
            {formatMarkedDate(markedAt)}
          </p>
          {status && <p className="report-status">{status}</p>}
        </div>
        <div className="report-actions">
          <button
            type="button"
            className="button button-secondary button-sm"
            onClick={() => window.print()}
          >
            <PrinterIcon size={14} />
            Print / PDF
          </button>
          {actions}
        </div>
      </header>

      {evaluation.submissionNotes.length > 0 && (
        <div className="alert tone-fair" style={{ marginBottom: 16 }}>
          <AlertIcon />
          <div>
            <p className="alert-title">Issues with this submission</p>
            <ul>
              {evaluation.submissionNotes.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <div className="report-grid">
        <div className={`card score-card tone-${band.tone}`}>
          <span className="eyebrow">Total score</span>
          <ScoreRing score={totalScore} maximum={maximumScore} />
          <span className="band">{band.label}</span>
          <p className="score-percent">{percentage}% of available marks</p>

          <div className="length-summary">
            <div className="length-summary-row">
              <strong>
                {evaluation.wordCount.toLocaleString("en")} words
              </strong>
              <span className={`status-pill tone-${lengthStatus.tone}`}>
                {lengthStatus.label}
              </span>
            </div>
            <p>
              Target {targetWordCount.minimum}–{targetWordCount.maximum}{" "}
              words. {targetWordCount.penaltyExplanation}
            </p>
            {targetWordCount.reviewRequired && (
              <p style={{ color: "var(--fair)" }}>
                No length penalty was applied; a teacher may want to review
                this.
              </p>
            )}
          </div>
        </div>

        <div className="report-stack">
          <section className="card" aria-labelledby="comment-title">
            <div className="card-header">
              <h3 className="card-title" id="comment-title">
                Examiner’s comment
              </h3>
            </div>
            <div className="card-body">
              <p className="comment">{evaluation.overallFeedback}</p>
            </div>
          </section>

          <section className="card" aria-labelledby="breakdown-title">
            <div className="card-header">
              <h3 className="card-title" id="breakdown-title">
                Score breakdown
              </h3>
            </div>
            <div className="card-body">
              <ul className="rubric-list">
                {RUBRIC_CATEGORIES.map(({ key, label, maximum }) => {
                  const category = evaluation.rubric[key];
                  const tone = getPerformanceBand(category.score, maximum).tone;
                  return (
                    <li className={`rubric-row tone-${tone}`} key={key}>
                      <div className="rubric-row-head">
                        <span className="rubric-row-name">{label}</span>
                        <span className="rubric-row-score">
                          <strong>{category.score}</strong>
                          <span> / {maximum}</span>
                        </span>
                      </div>
                      <div
                        className="bar"
                        role="progressbar"
                        aria-label={`${label} score`}
                        aria-valuenow={category.score}
                        aria-valuemin={0}
                        aria-valuemax={maximum}
                      >
                        <span
                          style={{
                            width: `${(category.score / maximum) * 100}%`,
                          }}
                        />
                      </div>
                      <p>{category.feedback}</p>
                    </li>
                  );
                })}
              </ul>
            </div>
          </section>
        </div>
      </div>

      <div className="report-columns">
        <section className="card" aria-labelledby="corrections-title">
          <div className="card-header">
            <div>
              <h3 className="card-title" id="corrections-title">
                Corrections
              </h3>
              <p className="card-subtitle">
                {evaluation.corrections.length === 0
                  ? "No specific corrections"
                  : `${evaluation.corrections.length} suggested ${
                      evaluation.corrections.length === 1 ? "fix" : "fixes"
                    } from your essay`}
              </p>
            </div>
          </div>
          <div className="card-body">
            {evaluation.corrections.length === 0 ? (
              <p className="empty-state">
                The examiner did not flag any specific sentences to correct.
              </p>
            ) : (
              <ul className="correction-list">
                {evaluation.corrections.map((correction, index) => (
                  <li
                    className="correction"
                    key={`${index}-${correction.excerpt}`}
                  >
                    <div className="correction-pair">
                      <span className="correction-tag original">You wrote</span>
                      <span className="correction-original">
                        {correction.excerpt}
                      </span>
                      <span className="correction-tag revised">Better</span>
                      <span className="correction-revised">
                        {correction.correction}
                      </span>
                    </div>
                    <p className="correction-why">{correction.explanation}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <section className="card" aria-labelledby="steps-title">
          <div className="card-header">
            <div>
              <h3 className="card-title" id="steps-title">
                How to improve
              </h3>
              <p className="card-subtitle">Focus on these next time</p>
            </div>
          </div>
          <div className="card-body">
            <ol className="steps">
              {evaluation.actionableAdvice.map((advice, index) => (
                <li key={`${index}-${advice}`}>
                  <span>{advice}</span>
                </li>
              ))}
            </ol>
            {suggestedTopic && (
              <Link className="lesson-suggestion" href={`/learn#${suggestedTopic.id}`}>
                <BookIcon size={18} />
                <div>
                  <strong>Watch: {suggestedTopic.label} lessons</strong>
                  <span>Recommended for your {weakest.label.toLowerCase()} score</span>
                </div>
                <ArrowRightIcon className="lesson-arrow" />
              </Link>
            )}
          </div>
        </section>
      </div>

      {evaluation.transcription && (
        <section className="card transcription-card" aria-labelledby="transcription-title">
          <details>
            <summary className="card-header">
              <div>
                <h3 className="card-title" id="transcription-title">
                  What the examiner read
                </h3>
                <p className="card-subtitle">
                  Transcribed from your {evaluation.pageCount}{" "}
                  {evaluation.pageCount === 1 ? "page" : "pages"}. If words were
                  misread, write more clearly or retake the photos.
                </p>
              </div>
              <span className="details-toggle" aria-hidden="true" />
            </summary>
            <div className="card-body">
              <p className="transcription">{evaluation.transcription}</p>
            </div>
          </details>
        </section>
      )}
    </section>
  );
}

export function ReportSkeleton() {
  return (
    <section className="report" aria-busy="true" aria-live="polite">
      <p className="loading-status">
        <span className="spinner" aria-hidden="true" />
        Reading your handwriting and marking your essay. This usually takes
        15–45 seconds.
      </p>
      <div className="report-grid" aria-hidden="true">
        <div className="card score-card">
          <div
            className="skeleton"
            style={{ width: 168, height: 168, borderRadius: "50%", margin: "8px auto 16px" }}
          />
          <div className="skeleton" style={{ width: 96, height: 24, margin: "0 auto" }} />
        </div>
        <div className="report-stack">
          {[3, 6].map((lines) => (
            <div className="card card-body" key={lines}>
              <div className="skeleton" style={{ width: 160, height: 18, marginBottom: 18 }} />
              {Array.from({ length: lines }, (_, index) => (
                <div
                  className="skeleton"
                  key={index}
                  style={{
                    width: `${92 - ((index * 17) % 30)}%`,
                    height: 12,
                    marginTop: 10,
                  }}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
