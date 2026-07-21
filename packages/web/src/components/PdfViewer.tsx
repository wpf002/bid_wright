"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { ChevronLeft, ChevronRight, Loader2, AlertCircle, ZoomIn, ZoomOut } from "lucide-react";
import { api } from "@/lib/api";

/**
 * pdf.js viewer for a bid's source ITB.
 *
 * `page` is controlled by the parent: clicking a scope item sets it, which is
 * how click-through provenance lands on the right page. pdf.js is imported
 * dynamically because it touches DOM APIs and must not run during SSR.
 */

interface Props {
  /** Fetch the bid's stored ITB. Ignored when `data` is given. */
  bidId?: string;
  /** Render these bytes directly — used to preview a freshly generated PDF. */
  data?: ArrayBuffer;
  page: number;
  onPageChange: (page: number) => void;
  /** Bumped by the parent to re-scroll when the same page is clicked twice. */
  jumpNonce?: number;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PdfDoc = any;

export function PdfViewer({ bidId, data, page, onPageChange, jumpNonce }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const docRef = useRef<PdfDoc | null>(null);
  /** Guards against out-of-order renders when pages change quickly. */
  const renderSeq = useRef(0);

  const [numPages, setNumPages] = useState(0);
  const [scale, setScale] = useState(1.2);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load the document once per bid.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const pdfjs = await import("pdfjs-dist");
        // Served from public/, copied there from the installed pdfjs-dist by
        // scripts/copy-pdf-worker.mjs on predev/prebuild. Importing it through
        // webpack instead would drag a 1.3 MB minified bundle through the
        // parser on every build.
        pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

        // A blob preview passes bytes straight in; the editor fetches the
        // stored ITB. Same renderer either way — relying on the browser's PDF
        // plugin in an iframe doesn't work everywhere.
        const bytes = data ?? (bidId ? await api.fetchPdf(bidId) : null);
        if (!bytes) throw new Error("Nothing to render");
        if (cancelled) return;
        const doc = await pdfjs.getDocument({ data: bytes.slice(0) }).promise;
        if (cancelled) return;
        docRef.current = doc;
        setNumPages(doc.numPages);

        // Fit the page to the available width so it doesn't overflow on a
        // phone. Caps at 1.2 so it never upscales on a wide desktop pane, and
        // the +/- controls still override it. Container may be hidden (width 0)
        // when the editor opens on mobile, so fall back to the window width.
        try {
          const first = await doc.getPage(1);
          const natural = first.getViewport({ scale: 1 }).width;
          const avail = (containerRef.current?.clientWidth || window.innerWidth) - 24;
          if (!cancelled && natural > 0) {
            setScale(Math.max(0.4, Math.min(1.2, avail / natural)));
          }
        } catch {
          // Keep the default scale if measuring fails.
        }

        setLoading(false);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Could not load the PDF");
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
      docRef.current?.destroy?.();
      docRef.current = null;
    };
  }, [bidId, data]);

  const render = useCallback(async () => {
    const doc = docRef.current;
    const canvas = canvasRef.current;
    if (!doc || !canvas) return;

    const seq = ++renderSeq.current;
    const pageNum = Math.min(Math.max(1, page), doc.numPages);
    const pdfPage = await doc.getPage(pageNum);
    if (seq !== renderSeq.current) return; // a newer render won

    const viewport = pdfPage.getViewport({ scale });
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Render at device resolution so text stays crisp on retina.
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.floor(viewport.width * dpr);
    canvas.height = Math.floor(viewport.height * dpr);
    canvas.style.width = `${Math.floor(viewport.width)}px`;
    canvas.style.height = `${Math.floor(viewport.height)}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    await pdfPage.render({ canvasContext: ctx, viewport }).promise;
  }, [page, scale]);

  useEffect(() => {
    if (!loading && !error) void render();
  }, [render, loading, error]);

  // Scroll the page into view when provenance jumps here.
  useEffect(() => {
    containerRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }, [page, jumpNonce]);

  if (error) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center">
        <AlertCircle className="h-6 w-6 text-red-500" />
        <p className="text-sm text-slate-500">{error}</p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2 dark:border-slate-800">
        <div className="flex items-center gap-1">
          <button
            onClick={() => onPageChange(Math.max(1, page - 1))}
            disabled={page <= 1}
            aria-label="Previous page"
            className="btn-ghost h-7 w-7 p-0"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="font-mono text-xs text-slate-500">
            {loading ? "—" : `${page} / ${numPages}`}
          </span>
          <button
            onClick={() => onPageChange(Math.min(numPages, page + 1))}
            disabled={page >= numPages}
            aria-label="Next page"
            className="btn-ghost h-7 w-7 p-0"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setScale((s) => Math.max(0.5, +(s - 0.2).toFixed(1)))}
            aria-label="Zoom out"
            className="btn-ghost h-7 w-7 p-0"
          >
            <ZoomOut className="h-4 w-4" />
          </button>
          <span className="font-mono text-xs text-slate-500">{Math.round(scale * 100)}%</span>
          <button
            onClick={() => setScale((s) => Math.min(3, +(s + 0.2).toFixed(1)))}
            aria-label="Zoom in"
            className="btn-ghost h-7 w-7 p-0"
          >
            <ZoomIn className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div ref={containerRef} className="flex-1 overflow-auto bg-slate-100 p-4 dark:bg-slate-950">
        {loading ? (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
          </div>
        ) : (
          <canvas ref={canvasRef} className="mx-auto shadow-soft" />
        )}
      </div>
    </div>
  );
}
