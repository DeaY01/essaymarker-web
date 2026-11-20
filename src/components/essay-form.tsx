"use client";

import { useRef, useState, type DragEvent, type FormEvent } from "react";
import {
  AlertIcon,
  ArrowRightIcon,
  CameraIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CoinsIcon,
  LockIcon,
  RotateIcon,
  TrashIcon,
  UploadIcon,
} from "@/components/icons";
import { BuyUnitsButton } from "@/components/billing/buy-units";
import type { AuthStatus } from "@/components/essay-marker";
import { formatNaira, UNIT_PACK } from "@/lib/billing";
import type { EssayPageDraft } from "@/components/use-essay-pages";
import Link from "next/link";
import { MAX_PAGES, TOPIC_MAX_LENGTH } from "@/lib/essay-rules";

interface EssayFormProps {
  topic: string;
  pages: EssayPageDraft[];
  error: string;
  isSubmitting: boolean;
  authStatus: AuthStatus;
  /** Units left, or null while unknown. */
  credits: number | null;
  onTopicChange: (value: string) => void;
  onAddFiles: (files: File[]) => string | null;
  onRotatePage: (id: string) => void;
  onMovePage: (id: string, offset: -1 | 1) => void;
  onRemovePage: (id: string) => void;
  onSubmit: () => void;
  onClear: () => void;
}

export function EssayForm({
  topic,
  pages,
  error,
  isSubmitting,
  authStatus,
  credits,
  onTopicChange,
  onAddFiles,
  onRotatePage,
  onMovePage,
  onRemovePage,
  onSubmit,
  onClear,
}: EssayFormProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadNotice, setUploadNotice] = useState("");

  const isFull = pages.length >= MAX_PAGES;
  const isProcessing = pages.some((page) => page.status === "processing");
  const hasBrokenPage = pages.some((page) => page.status === "error");
  const isSignedIn = authStatus === "signed-in";
  const isOutOfUnits = isSignedIn && credits === 0;
  const uploadDisabled = isSubmitting || authStatus === "signed-out";
  const canSubmit =
    isSignedIn && pages.length > 0 && !isProcessing && !hasBrokenPage && !isSubmitting;
  const hasContent = topic.trim().length > 0 || pages.length > 0;

  function addFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploadNotice(onAddFiles(Array.from(files)) ?? "");
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(false);
    if (!uploadDisabled) addFiles(event.dataTransfer.files);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (canSubmit) onSubmit();
  }

  return (
    <form className="card" onSubmit={handleSubmit} aria-labelledby="form-title" noValidate>
      <div className="card-header">
        <div>
          <h2 className="card-title" id="form-title">
            Your handwritten essay
          </h2>
          <p className="card-subtitle">
            Write on paper, then upload a photo of each page. Typed essays are
            not accepted.
          </p>
        </div>
      </div>

      <div className="card-body">
        {isOutOfUnits && (
          <div className="alert tone-fair" style={{ marginBottom: 20 }}>
            <CoinsIcon />
            <div>
              <p className="alert-title">You’ve used all your units</p>
              <p>
                Each essay uses 1 unit. Buy {UNIT_PACK.units} units for{" "}
                {formatNaira(UNIT_PACK.priceNaira)} to keep getting your essays marked.
              </p>
              <div className="alert-actions">
                <BuyUnitsButton />
              </div>
            </div>
          </div>
        )}
        {authStatus === "signed-out" && (
          <div className="alert tone-good" style={{ marginBottom: 20 }}>
            <LockIcon />
            <div>
              <p className="alert-title">Sign in to get your essay marked</p>
              <p>
                Marking is free, but you need an account. Sign in or create one
                before adding your photos.
              </p>
              <div className="alert-actions">
                <Link className="button button-primary button-sm" href="/sign-up">
                  Create free account
                </Link>
                <Link className="button button-secondary button-sm" href="/sign-in">
                  Sign in
                </Link>
              </div>
            </div>
          </div>
        )}
        <div className="field">
          <div className="field-label-row">
            <label className="field-label" htmlFor="topic">
              Topic or question
            </label>
          </div>
          <input
            id="topic"
            className="input"
            type="text"
            autoComplete="off"
            placeholder="e.g. Write a letter to your friend about the importance of reading"
            value={topic}
            onChange={(event) => onTopicChange(event.target.value)}
            disabled={isSubmitting}
          />
          {topic.trim().length > TOPIC_MAX_LENGTH && (
            <p className="field-hint">
              Only the first {TOPIC_MAX_LENGTH.toLocaleString("en")} characters
              of the topic will be used.
            </p>
          )}
        </div>

        <div className="field">
          <div className="field-label-row">
            <span className="field-label" id="pages-label">
              Essay pages
            </span>
            <span className="field-optional">
              {pages.length} of {MAX_PAGES} pages
            </span>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={(event) => {
              addFiles(event.target.files);
              event.target.value = "";
            }}
          />
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            hidden
            onChange={(event) => {
              addFiles(event.target.files);
              event.target.value = "";
            }}
          />

          {!isFull && (
            <div
              className={`dropzone${isDragging ? " is-dragging" : ""}`}
              onDragOver={(event) => {
                event.preventDefault();
                if (!uploadDisabled) setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
            >
              <span className="dropzone-icon" aria-hidden="true">
                <UploadIcon size={22} />
              </span>
              <p className="dropzone-title">
                {pages.length === 0
                  ? "Add photos of your essay pages"
                  : "Add the next page"}
              </p>
              <p className="dropzone-text">
                Drag photos here, or choose them below. One photo per page, in
                order.
              </p>
              <div className="dropzone-actions">
                <button
                  type="button"
                  className="button button-secondary button-sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadDisabled}
                >
                  <UploadIcon size={14} />
                  Choose photos
                </button>
                <button
                  type="button"
                  className="button button-secondary button-sm camera-button"
                  onClick={() => cameraInputRef.current?.click()}
                  disabled={uploadDisabled}
                >
                  <CameraIcon size={14} />
                  Take photo
                </button>
              </div>
            </div>
          )}

          {uploadNotice && (
            <p className="field-hint" role="status">
              {uploadNotice}
            </p>
          )}

          {pages.length > 0 && (
            <ol className="page-grid" aria-labelledby="pages-label">
              {pages.map((page, index) => (
                <li className={`page-tile is-${page.status}`} key={page.id}>
                  <div className="page-preview">
                    {page.previewUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element -- local blob preview
                      <img src={page.previewUrl} alt={`Page ${index + 1} of your essay`} />
                    ) : page.status === "error" ? (
                      <span className="page-error">
                        <AlertIcon size={18} />
                        {page.error}
                      </span>
                    ) : null}
                    {page.status === "processing" && (
                      <span className="page-processing">
                        <span className="spinner" aria-hidden="true" />
                        <span className="sr-only">Preparing page {index + 1}</span>
                      </span>
                    )}
                    <span className="page-number">Page {index + 1}</span>
                  </div>
                  <div className="page-actions">
                    <button
                      type="button"
                      className="icon-button"
                      onClick={() => onMovePage(page.id, -1)}
                      disabled={isSubmitting || index === 0}
                      aria-label={`Move page ${index + 1} earlier`}
                      title="Move earlier"
                    >
                      <ChevronLeftIcon />
                    </button>
                    <button
                      type="button"
                      className="icon-button"
                      onClick={() => onMovePage(page.id, 1)}
                      disabled={isSubmitting || index === pages.length - 1}
                      aria-label={`Move page ${index + 1} later`}
                      title="Move later"
                    >
                      <ChevronRightIcon />
                    </button>
                    <button
                      type="button"
                      className="icon-button"
                      onClick={() => onRotatePage(page.id)}
                      disabled={isSubmitting || page.status === "error"}
                      aria-label={`Rotate page ${index + 1}`}
                      title="Rotate"
                    >
                      <RotateIcon />
                    </button>
                    <button
                      type="button"
                      className="icon-button danger"
                      onClick={() => onRemovePage(page.id)}
                      disabled={isSubmitting}
                      aria-label={`Remove page ${index + 1}`}
                      title="Remove"
                    >
                      <TrashIcon />
                    </button>
                  </div>
                </li>
              ))}
            </ol>
          )}
          {hasBrokenPage && (
            <p className="field-hint">
              Remove the photos that couldn’t be used before submitting.
            </p>
          )}
        </div>

        {error && (
          <div className="alert tone-weak" role="alert" style={{ marginTop: 20 }}>
            <AlertIcon />
            <div>
              <p className="alert-title">We couldn’t mark your essay</p>
              <p>{error}</p>
            </div>
          </div>
        )}
      </div>

      <div className="form-footer">
        <span className="form-note">
          <LockIcon size={14} />
          Your photos are sent securely for marking.
          {isSignedIn && credits !== null && credits > 0 && (
            <span className="form-note-units">
              · Uses 1 of your {credits} {credits === 1 ? "unit" : "units"}
            </span>
          )}
        </span>
        <div className="form-actions">
          <button
            type="button"
            className="button button-ghost"
            onClick={onClear}
            disabled={isSubmitting || !hasContent}
          >
            Clear
          </button>
          {authStatus === "signed-out" ? (
            <Link className="button button-primary" href="/sign-in">
              Sign in to mark
              <ArrowRightIcon />
            </Link>
          ) : isOutOfUnits ? (
            <BuyUnitsButton
              className="button button-primary"
              reason="You’ve used all your units. Buy more to keep getting your essays marked."
            >
              Buy units to mark
            </BuyUnitsButton>
          ) : (
            <button type="submit" className="button button-primary" disabled={!canSubmit}>
              {isSubmitting ? (
                <>
                  <span className="spinner" aria-hidden="true" />
                  Marking…
                </>
              ) : (
                <>
                  Mark my essay
                  <ArrowRightIcon />
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </form>
  );
}
