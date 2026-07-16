"use client";

import { useState, useRef, useEffect } from "react";
import { toast } from "sonner";
import { Download, ChevronDown, FileSpreadsheet, FileText, FileType, Loader2, Eye, X } from "lucide-react";
import type { BidRow } from "@/lib/api";
import { lineItemsToCsv, exportFileName, downloadBlob } from "@/lib/export";
import { buildProposalDoc } from "@/lib/proposal";
import { PdfViewer } from "@/components/PdfViewer";
import type { CompanyProfile } from "@/lib/api";

/**
 * Export menu. The heavy builders (docx, jspdf) are dynamically imported inside
 * their handlers so they never load unless the user actually exports.
 */
export function ExportMenu({
  bid,
  profile,
  logoDataUrl,
}: {
  bid: BidRow;
  profile: CompanyProfile | null;
  logoDataUrl: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [previewData, setPreviewData] = useState<ArrayBuffer | null>(null);
  const [previewPage, setPreviewPage] = useState(1);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onEsc);
    };
  }, [open]);

  async function run(kind: "csv" | "docx" | "pdf") {
    setBusy(kind);
    try {
      if (kind === "csv") {
        const csv = lineItemsToCsv(bid);
        downloadBlob(new Blob([csv], { type: "text/csv;charset=utf-8" }), exportFileName(bid, "csv"));
      } else if (kind === "docx") {
        const { buildDocx } = await import("@/lib/export-docx");
        const doc = buildProposalDoc(bid, profile, logoDataUrl);
        downloadBlob(await buildDocx(doc), exportFileName(bid, "docx"));
      } else {
        const { buildPdf } = await import("@/lib/export-pdf");
        const doc = buildProposalDoc(bid, profile, logoDataUrl);
        downloadBlob(await buildPdf(doc), exportFileName(bid, "pdf"));
      }
      toast.success(`Exported ${kind.toUpperCase()}`);
      setOpen(false);
    } catch (err) {
      toast.error(`Could not export ${kind.toUpperCase()}`, {
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setBusy(null);
    }
  }

  async function preview() {
    setBusy("preview");
    try {
      const { buildPdf } = await import("@/lib/export-pdf");
      const blob = await buildPdf(buildProposalDoc(bid, profile, logoDataUrl));
      // Same builder as the download, so what's previewed is what ships.
      setPreviewData(await blob.arrayBuffer());
      setPreviewPage(1);
      setOpen(false);
    } catch (err) {
      toast.error("Could not build the preview", {
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setBusy(null);
    }
  }

  function closePreview() {
    setPreviewData(null);
  }

  const items = [
    { kind: "pdf" as const, label: "PDF proposal", icon: FileType },
    { kind: "docx" as const, label: "Word (.docx)", icon: FileText },
    { kind: "csv" as const, label: "Line items (.csv)", icon: FileSpreadsheet },
  ];

  return (
    <>
      {previewData && (
        <div
          className="fixed inset-0 z-50 flex flex-col bg-slate-900/60 p-4 backdrop-blur-sm"
          onClick={closePreview}
          role="presentation"
        >
          <div
            className="mx-auto flex h-full w-full max-w-4xl flex-col overflow-hidden rounded-xl bg-white shadow-card dark:bg-slate-900"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Proposal preview"
          >
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-2 dark:border-slate-800">
              <span className="text-sm font-medium text-slate-900 dark:text-slate-100">Proposal preview</span>
              <div className="flex items-center gap-2">
                <button onClick={() => void run("pdf")} className="btn-primary px-3 py-1.5 text-xs">
                  <Download className="h-3.5 w-3.5" />
                  Download
                </button>
                <button onClick={closePreview} aria-label="Close preview" className="btn-ghost h-7 w-7 p-0">
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="min-h-0 flex-1">
              <PdfViewer data={previewData} page={previewPage} onPageChange={setPreviewPage} />
            </div>
          </div>
        </div>
      )}

    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="btn-secondary px-2.5 py-1.5 text-xs"
      >
        <Download className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Export</span>
        <ChevronDown className="h-3 w-3" />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-20 mt-1 w-48 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-card dark:border-slate-800 dark:bg-slate-900"
        >
          <button
            role="menuitem"
            disabled={busy !== null}
            onClick={() => void preview()}
            className="flex w-full items-center gap-2 border-b border-slate-100 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            {busy === "preview" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4 text-slate-400" />}
            Preview proposal
          </button>
          {items.map((it) => (
            <button
              key={it.kind}
              role="menuitem"
              disabled={busy !== null}
              onClick={() => void run(it.kind)}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              {busy === it.kind ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <it.icon className="h-4 w-4 text-slate-400" />
              )}
              {it.label}
            </button>
          ))}
        </div>
      )}
    </div>
    </>
  );
}
