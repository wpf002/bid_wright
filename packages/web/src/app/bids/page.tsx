"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function AllBidsPage() {
  return (
    <div className="mx-auto max-w-7xl px-8 py-8">
      <Link href="/dashboard" className="mb-4 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900">
        <ArrowLeft className="h-4 w-4" /> Back to bid board
      </Link>
      <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">All bids</h1>
      <p className="mt-1 text-sm text-slate-500">Full historical bid list with advanced filters.</p>
      <div className="mt-8 rounded-xl border border-dashed border-slate-300 p-12 text-center text-slate-500 dark:border-slate-700">
        Full bid list — Phase 3 (Week 3-5)
      </div>
    </div>
  );
}
