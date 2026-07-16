"use client";

import { useState, useRef, useEffect } from "react";
import { toast } from "sonner";
import { Download, ChevronDown, FileSpreadsheet, FileText, FileType, Loader2 } from "lucide-react";
import type { BidRow } from "@/lib/api";
import { lineItemsToCsv, exportFileName, downloadBlob, toProposalData } from "@/lib/export";

/**
 * Export menu. The heavy builders (docx, jspdf) are dynamically imported inside
 * their handlers so they never load unless the user actually exports.
 */
export function ExportMenu({ bid, companyName }: { bid: BidRow; companyName: string }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
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
        downloadBlob(await buildDocx(toProposalData(bid, companyName)), exportFileName(bid, "docx"));
      } else {
        const { buildPdf } = await import("@/lib/export-pdf");
        downloadBlob(await buildPdf(toProposalData(bid, companyName)), exportFileName(bid, "pdf"));
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

  const items = [
    { kind: "pdf" as const, label: "PDF proposal", icon: FileType },
    { kind: "docx" as const, label: "Word (.docx)", icon: FileText },
    { kind: "csv" as const, label: "Line items (.csv)", icon: FileSpreadsheet },
  ];

  return (
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
  );
}
