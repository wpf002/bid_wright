"use client";

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { UploadCloud, FileText, Loader2, CheckCircle2, ArrowLeft, AlertCircle, X } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { useRequireAuth } from "@/lib/auth-context";

/**
 * Stages reflect real work, not a timer: `uploading` tracks actual bytes sent,
 * `extracting` and `drafting` each correspond to one awaited server call.
 */
type Stage = "idle" | "uploading" | "extracting" | "drafting" | "done" | "error";

const MAX_BYTES = 50 * 1024 * 1024; // matches the API's multipart limit

const STEPS: { key: Stage; label: string }[] = [
  { key: "uploading", label: "Uploading PDF" },
  { key: "extracting", label: "Reading pages and extracting scope" },
  { key: "drafting", label: "Drafting bid response" },
];

const ORDER: Stage[] = ["idle", "uploading", "extracting", "drafting", "done"];
const rank = (s: Stage) => ORDER.indexOf(s);

export default function NewBidPage() {
  useRequireAuth();
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [stage, setStage] = useState<Stage>("idle");
  const [percent, setPercent] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Set once extraction lands, so a drafting failure can retry without re-uploading. */
  const [bidId, setBidId] = useState<string | null>(null);

  const busy = stage === "uploading" || stage === "extracting" || stage === "drafting";

  const accept = useCallback((chosen: File | undefined | null) => {
    if (!chosen) return;
    if (!chosen.name.toLowerCase().endsWith(".pdf") && chosen.type !== "application/pdf") {
      setError("That file isn't a PDF.");
      return;
    }
    if (chosen.size > MAX_BYTES) {
      setError(`That file is ${(chosen.size / 1024 / 1024).toFixed(0)} MB — the limit is 50 MB.`);
      return;
    }
    setError(null);
    setFile(chosen);
  }, []);

  async function draft(id: string) {
    setStage("drafting");
    await api.generateBid(id);
    setStage("done");
    toast.success("Bid response drafted");
    router.push(`/bids/${id}`);
  }

  async function run() {
    if (!file) return;
    setError(null);
    setPercent(0);
    try {
      setStage("uploading");
      const bid = await api.uploadItb(file, (p) => {
        setPercent(p);
        // Bytes are sent; the server is now reading the PDF and calling the model.
        if (p >= 100) setStage("extracting");
      });
      setBidId(bid.id);
      await draft(bid.id);
    } catch (err) {
      setStage("error");
      const message = err instanceof ApiError ? err.message : "Something went wrong.";
      setError(message);
      toast.error(message);
    }
  }

  async function retryDraft() {
    if (!bidId) return;
    setError(null);
    try {
      await draft(bidId);
    } catch (err) {
      setStage("error");
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-8 py-8">
      <Link
        href="/dashboard"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900 dark:hover:text-slate-200"
      >
        <ArrowLeft className="h-4 w-4" />
        Bid Board
      </Link>

      <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">New Bid</h1>
      <p className="mt-1 text-sm text-slate-500">
        Drop in the ITB PDF. BidWright reads the scope, quantities, deadlines, and compliance
        requirements, then drafts a response you can edit.
      </p>

      {!busy && stage !== "done" && (
        <>
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              accept(e.dataTransfer.files?.[0]);
            }}
            onClick={() => inputRef.current?.click()}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
            }}
            className={`mt-6 flex cursor-pointer flex-col items-center rounded-xl border-2 border-dashed px-6 py-14 text-center transition-colors ${
              dragging
                ? "border-amber-500 bg-amber-50/50 dark:bg-amber-950/20"
                : "border-slate-300 hover:border-slate-400 dark:border-slate-700 dark:hover:border-slate-600"
            }`}
          >
            <UploadCloud className={`h-9 w-9 ${dragging ? "text-amber-500" : "text-slate-400"}`} />
            <p className="mt-3 text-sm font-medium text-slate-900 dark:text-slate-100">
              Drop your ITB PDF here
            </p>
            <p className="mt-1 text-xs text-slate-500">or click to browse · PDF up to 50 MB</p>
            <input
              ref={inputRef}
              type="file"
              accept="application/pdf,.pdf"
              className="hidden"
              onChange={(e) => accept(e.target.files?.[0])}
            />
          </div>

          {file && (
            <div className="card mt-4 flex items-center gap-3 p-4">
              <FileText className="h-5 w-5 shrink-0 text-amber-600" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">
                  {file.name}
                </div>
                <div className="font-mono text-xs text-slate-500">
                  {(file.size / 1024 / 1024).toFixed(2)} MB
                </div>
              </div>
              <button
                onClick={() => setFile(null)}
                aria-label="Remove file"
                className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          {error && (
            <div role="alert" className="mt-4 flex items-start gap-2 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950/50 dark:text-red-300">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <div className="flex-1">
                {error}
                {bidId && (
                  <button onClick={() => void retryDraft()} className="ml-2 font-medium underline">
                    Retry drafting
                  </button>
                )}
              </div>
            </div>
          )}

          <button
            onClick={() => void run()}
            disabled={!file}
            className="btn-primary mt-6 w-full px-4 py-2.5 text-sm"
          >
            Extract and Draft Response
          </button>
        </>
      )}

      {(busy || stage === "done") && (
        <div className="card mt-6 p-6">
          <ol className="space-y-4">
            {STEPS.map((step) => {
              const state =
                rank(stage) > rank(step.key) || stage === "done"
                  ? "done"
                  : stage === step.key
                    ? "active"
                    : "pending";
              return (
                <li key={step.key} className="flex items-center gap-3">
                  {state === "done" ? (
                    <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
                  ) : state === "active" ? (
                    <Loader2 className="h-5 w-5 shrink-0 animate-spin text-amber-500" />
                  ) : (
                    <div className="h-5 w-5 shrink-0 rounded-full border-2 border-slate-200 dark:border-slate-700" />
                  )}
                  <span
                    className={
                      state === "pending"
                        ? "text-sm text-slate-400"
                        : "text-sm text-slate-900 dark:text-slate-100"
                    }
                  >
                    {step.label}
                    {step.key === "uploading" && stage === "uploading" && ` — ${percent}%`}
                  </span>
                </li>
              );
            })}
          </ol>

          {stage === "uploading" && (
            <div className="mt-5 h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
              <div
                className="h-full rounded-full bg-amber-500 transition-all duration-200"
                style={{ width: `${percent}%` }}
              />
            </div>
          )}

          <p className="mt-5 text-xs text-slate-500">
            Reading and drafting usually takes under a minute. Large ITBs take longer.
          </p>
        </div>
      )}
    </div>
  );
}
