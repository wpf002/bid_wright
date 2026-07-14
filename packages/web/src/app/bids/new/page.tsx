"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { UploadCloud, FileText, Loader2, CheckCircle2, ArrowLeft } from "lucide-react";
import Link from "next/link";

type Stage = "idle" | "uploading" | "parsing" | "extracting" | "generating" | "done" | "error";

const STAGE_LABELS: Record<Stage, string> = {
  idle: "",
  uploading: "Uploading PDF...",
  parsing: "Reading pages...",
  extracting: "Extracting scope, deadlines, requirements...",
  generating: "Drafting bid response...",
  done: "Ready.",
  error: "Something went wrong.",
};

export default function NewBidPage() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [stage, setStage] = useState<Stage>("idle");
  const [dragging, setDragging] = useState(false);

  async function handleSubmit() {
    if (!file) return;
    setStage("uploading");
    const fd = new FormData();
    fd.append("file", file);

    try {
      // Simulate progressive stages for user feedback
      setTimeout(() => setStage("parsing"), 400);
      setTimeout(() => setStage("extracting"), 1200);
      setTimeout(() => setStage("generating"), 3000);

      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/uploads/itb`, {
        method: "POST",
        body: fd,
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setStage("done");
      toast.success("Bid response drafted");
      setTimeout(() => router.push(`/bids/${data.id}`), 800);
    } catch (err) {
      setStage("error");
      toast.error("Failed to process ITB", { description: String(err) });
    }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped && dropped.type === "application/pdf") setFile(dropped);
    else toast.error("Please upload a PDF");
  }

  const processing = stage !== "idle" && stage !== "error" && stage !== "done";

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <Link href="/dashboard" className="mb-6 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900 dark:hover:text-slate-100">
        <ArrowLeft className="h-4 w-4" />
        Back to bid board
      </Link>

      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">New bid</h1>
        <p className="mt-1 text-sm text-slate-500">
          Upload the ITB PDF the GC sent you. We&apos;ll extract the scope and draft a response.
        </p>
      </div>

      {stage === "idle" && (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={`
            flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-16 text-center transition-colors
            ${dragging ? "border-amber-500 bg-amber-50 dark:bg-amber-950/20"
                       : "border-slate-300 bg-white hover:border-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-slate-600"}
          `}
        >
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 text-amber-600">
            <UploadCloud className="h-7 w-7" />
          </div>
          <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100">
            Drop your ITB PDF here
          </h3>
          <p className="mt-1 text-sm text-slate-500">
            Or click below to browse
          </p>

          <label className="btn-primary mt-6 cursor-pointer px-4 py-2 text-sm">
            Choose file
            <input
              type="file"
              accept="application/pdf"
              className="sr-only"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </label>

          {file && (
            <div className="mt-6 flex items-center gap-2 rounded-md bg-slate-100 px-3 py-2 text-sm dark:bg-slate-800">
              <FileText className="h-4 w-4 text-slate-500" />
              <span className="font-medium text-slate-900 dark:text-slate-100">{file.name}</span>
              <span className="text-slate-500">({(file.size / 1024 / 1024).toFixed(1)} MB)</span>
              <button
                onClick={() => setFile(null)}
                className="ml-2 text-xs text-slate-500 hover:text-red-600"
              >
                Remove
              </button>
            </div>
          )}

          <p className="mt-8 text-xs text-slate-400">
            PDFs only · Up to 50 MB · Nothing is uploaded until you click generate
          </p>
        </div>
      )}

      {processing && (
        <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-6 flex justify-center">
            <Loader2 className="h-10 w-10 animate-spin text-amber-500" />
          </div>
          <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100">
            {STAGE_LABELS[stage]}
          </h3>
          <p className="mt-2 text-sm text-slate-500">
            This usually takes 45-90 seconds. Don&apos;t close the tab.
          </p>

          <div className="mx-auto mt-8 max-w-xs">
            <ProgressSteps current={stage} />
          </div>
        </div>
      )}

      {stage === "done" && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-12 text-center dark:border-emerald-900 dark:bg-emerald-950/30">
          <div className="mb-4 flex justify-center">
            <CheckCircle2 className="h-12 w-12 text-emerald-600" />
          </div>
          <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100">
            Bid response ready
          </h3>
          <p className="mt-1 text-sm text-slate-500">Redirecting to the editor...</p>
        </div>
      )}

      {stage === "error" && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-8 dark:border-red-900 dark:bg-red-950/30">
          <h3 className="text-base font-medium text-red-900 dark:text-red-100">
            Processing failed
          </h3>
          <p className="mt-1 text-sm text-red-700 dark:text-red-300">
            The PDF couldn&apos;t be processed. This can happen with scanned or password-protected files.
          </p>
          <button onClick={() => { setStage("idle"); setFile(null); }} className="btn-secondary mt-4 px-3 py-1.5 text-sm">
            Try again
          </button>
        </div>
      )}

      {stage === "idle" && file && (
        <div className="mt-6 flex justify-end">
          <button onClick={handleSubmit} className="btn-primary px-5 py-2.5 text-sm">
            Generate bid response
          </button>
        </div>
      )}
    </div>
  );
}

function ProgressSteps({ current }: { current: Stage }) {
  const steps: Stage[] = ["uploading", "parsing", "extracting", "generating"];
  const currentIdx = steps.indexOf(current);
  return (
    <div className="space-y-2 text-left">
      {steps.map((s, i) => (
        <div key={s} className="flex items-center gap-2 text-sm">
          {i < currentIdx ? (
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          ) : i === currentIdx ? (
            <Loader2 className="h-4 w-4 animate-spin text-amber-500" />
          ) : (
            <div className="h-4 w-4 rounded-full border-2 border-slate-300 dark:border-slate-700" />
          )}
          <span className={i <= currentIdx ? "text-slate-900 dark:text-slate-100" : "text-slate-400"}>
            {STAGE_LABELS[s]}
          </span>
        </div>
      ))}
    </div>
  );
}
