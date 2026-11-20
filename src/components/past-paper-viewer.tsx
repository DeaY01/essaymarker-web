"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy, RenderTask } from "pdfjs-dist";
import { AlertIcon } from "@/components/icons";

// Draws the paper with PDF.js onto <canvas> elements, so it looks the same on
// every browser (Android Chrome can't show PDFs inside a page) and there is no
// browser PDF toolbar, download or print button. Pages render as they scroll
// near the screen. Right-click is disabled on the viewer.

const MIN_ZOOM = 1;
const MAX_ZOOM = 3;
const ZOOM_STEP = 0.25;
/** Start rendering a page when it is this close to the screen. */
const PRELOAD_MARGIN = "800px 0px";
/** Keeps canvases small enough for low-memory phones (≈ 2400 px wide max). */
const MAX_CANVAS_WIDTH = 2400;

type PdfJs = typeof import("pdfjs-dist");

let pdfjsPromise: Promise<PdfJs> | null = null;

/** Loads PDF.js (legacy build, for older mobile browsers) only when needed. */
function loadPdfJs(): Promise<PdfJs> {
  pdfjsPromise ??= import("pdfjs-dist/legacy/build/pdf.mjs").then((pdfjs) => {
    pdfjs.GlobalWorkerOptions.workerSrc = new URL(
      "pdfjs-dist/legacy/build/pdf.worker.min.mjs",
      import.meta.url,
    ).toString();
    return pdfjs;
  });
  return pdfjsPromise;
}

type LoadState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; doc: PDFDocumentProxy; aspectRatio: number };

export function PastPaperViewer({ src, title }: { src: string; title: string }) {
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [zoom, setZoom] = useState(MIN_ZOOM);
  const [width, setWidth] = useState(0);
  const scrollerRef = useRef<HTMLDivElement>(null);

  // Load the document. The page gives this component key={src}, so a new paper
  // starts from fresh state (loading, 100%).
  useEffect(() => {
    let cancelled = false;
    let destroyTask: (() => Promise<void>) | null = null;

    loadPdfJs()
      .then((pdfjs) => {
        const task = pdfjs.getDocument({
          url: src,
          // Fetch the whole file at once: the signed URL expires after a few
          // minutes, so later range requests could fail.
          disableRange: true,
        });
        destroyTask = () => task.destroy();
        return task.promise;
      })
      .then(async (doc) => {
        const first = await doc.getPage(1);
        const viewport = first.getViewport({ scale: 1 });
        if (!cancelled) {
          setState({ status: "ready", doc, aspectRatio: viewport.height / viewport.width });
        }
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        console.error("Failed to open past paper:", error);
        setState({ status: "error" });
      });

    return () => {
      cancelled = true;
      void destroyTask?.();
    };
  }, [src]);

  // Track the available width so pages fit the screen at 100%.
  useEffect(() => {
    const element = scrollerRef.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      setWidth(Math.floor(entry.contentRect.width));
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const changeZoom = useCallback((delta: number) => {
    setZoom((value) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value + delta)));
  }, []);

  const pageWidth = Math.floor(width * zoom);

  return (
    <div className="paper-viewer-frame" onContextMenu={(event) => event.preventDefault()}>
      <div className="paper-toolbar">
        <span className="paper-toolbar-pages">
          {state.status === "ready"
            ? `${state.doc.numPages} ${state.doc.numPages === 1 ? "page" : "pages"}`
            : " "}
        </span>
        <div className="paper-zoom" role="group" aria-label="Zoom">
          <button
            type="button"
            className="paper-zoom-button"
            onClick={() => changeZoom(-ZOOM_STEP)}
            disabled={state.status !== "ready" || zoom <= MIN_ZOOM}
            aria-label="Zoom out"
          >
            −
          </button>
          <span className="paper-zoom-level" aria-live="polite">
            {Math.round(zoom * 100)}%
          </span>
          <button
            type="button"
            className="paper-zoom-button"
            onClick={() => changeZoom(ZOOM_STEP)}
            disabled={state.status !== "ready" || zoom >= MAX_ZOOM}
            aria-label="Zoom in"
          >
            +
          </button>
        </div>
      </div>

      <div className="paper-scroller" ref={scrollerRef} aria-label={title} role="document">
        {state.status === "loading" && (
          <div className="paper-status">
            <span className="spinner" aria-hidden="true" />
            Opening paper…
          </div>
        )}
        {state.status === "error" && (
          <div className="alert tone-weak" role="alert">
            <AlertIcon />
            <p>This paper couldn’t be opened. Please refresh the page and try again.</p>
          </div>
        )}
        {state.status === "ready" && pageWidth > 0 && (
          <div className="paper-pages" style={{ width: pageWidth }}>
            {Array.from({ length: state.doc.numPages }, (_, index) => (
              <PdfPage
                key={index}
                doc={state.doc}
                pageNumber={index + 1}
                width={pageWidth}
                aspectRatio={state.aspectRatio}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

interface PdfPageProps {
  doc: PDFDocumentProxy;
  pageNumber: number;
  /** CSS width in pixels. */
  width: number;
  /** Height ÷ width of the first page, used until this page's own size is known. */
  aspectRatio: number;
}

function PdfPage({ doc, pageNumber, width, aspectRatio }: PdfPageProps) {
  const holderRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isNear, setIsNear] = useState(false);
  const [ratio, setRatio] = useState(aspectRatio);
  const [rendered, setRendered] = useState(false);

  // Render once the page scrolls near the screen; it then stays rendered.
  useEffect(() => {
    const element = holderRef.current;
    if (!element) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsNear(true);
          observer.disconnect();
        }
      },
      { rootMargin: PRELOAD_MARGIN },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!isNear || width <= 0) return;
    let cancelled = false;
    let task: RenderTask | null = null;

    (async () => {
      const page = await doc.getPage(pageNumber);
      if (cancelled) return;
      const base = page.getViewport({ scale: 1 });
      setRatio(base.height / base.width);

      const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
      const scale = Math.min((width * pixelRatio) / base.width, MAX_CANVAS_WIDTH / base.width);
      const viewport = page.getViewport({ scale });

      // Draw off-screen, then swap in, so zooming doesn't flash a blank page.
      const offscreen = document.createElement("canvas");
      offscreen.width = Math.floor(viewport.width);
      offscreen.height = Math.floor(viewport.height);
      task = page.render({ canvas: offscreen, viewport });
      await task.promise;
      if (cancelled) return;

      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.width = offscreen.width;
      canvas.height = offscreen.height;
      canvas.getContext("2d")?.drawImage(offscreen, 0, 0);
      setRendered(true);
    })().catch((error: unknown) => {
      if (cancelled || (error as { name?: string })?.name === "RenderingCancelledException") return;
      console.error(`Failed to render page ${pageNumber}:`, error);
    });

    return () => {
      cancelled = true;
      task?.cancel();
    };
  }, [doc, isNear, pageNumber, width]);

  return (
    <div
      ref={holderRef}
      className={`paper-page${rendered ? " is-rendered" : ""}`}
      style={{ height: Math.round(width * ratio) }}
      aria-label={`Page ${pageNumber}`}
    >
      <canvas ref={canvasRef} draggable={false} aria-hidden="true" />
    </div>
  );
}
