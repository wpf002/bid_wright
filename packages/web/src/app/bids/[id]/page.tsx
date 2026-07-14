"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft, FileText, AlertTriangle, Download, Send,
  Plus, GripVertical, X,
} from "lucide-react";
import { cn, confidenceClass } from "@/lib/utils";

// Demo data matching the shape of a real BidResponse
const DEMO_BID = {
  id: "1",
  itbFileName: "downtown-office-electrical.pdf",
  status: "in_review",
  projectName: "Downtown Office Fitout — Level 3",
  gcName: "Turner Construction",
  bidDeadline: "2026-07-28",
  primaryTrade: "electrical",
  warnings: [
    "Panel schedule referenced on p.7 but not attached to the ITB.",
    "Bond amount unclear — document states either 5% or 10% depending on section.",
  ],
  lineItems: [
    { id: "li-1", description: "Rough-in wiring, tenant area", quantity: 12500, unit: "SF", unitCostCents: 0, totalCostCents: 0, confidence: 0.92, sourcePage: 3 },
    { id: "li-2", description: "Panel PP-1 installation & feeders", quantity: 1, unit: "EA", unitCostCents: 0, totalCostCents: 0, confidence: 0.88, sourcePage: 5 },
    { id: "li-3", description: "Recessed LED fixtures, 2x2", quantity: 84, unit: "EA", unitCostCents: 0, totalCostCents: 0, confidence: 0.75, sourcePage: 6 },
    { id: "li-4", description: "Wall packs, exit signage", quantity: 12, unit: "EA", unitCostCents: 0, totalCostCents: 0, confidence: 0.65, sourcePage: 8 },
    { id: "li-5", description: "Data cabling (Cat6A) rough-in", quantity: 3800, unit: "LF", unitCostCents: 0, totalCostCents: 0, confidence: 0.5, sourcePage: null },
  ],
  assumptions: [
    "Work performed during standard business hours unless noted.",
    "Existing structure adequate to support new fixture loads.",
    "GC to provide temporary power and lighting.",
    "Access to work area available with 24-hour notice.",
  ],
  clarifications: [
    "Confirm bond percentage — 5% or 10%?",
    "Panel schedule (p.7 reference) — please provide.",
    "Prevailing wage requirements — Davis-Bacon applicable?",
    "Fire alarm scope — included or separate contractor?",
  ],
  exclusions: [
    "Cutting and patching of finished surfaces.",
    "Temporary power beyond first 30 days.",
    "Permits and inspection fees.",
    "Cleanup beyond broom-clean of work area.",
    "Fire alarm system.",
    "Security low-voltage.",
  ],
};

type Tab = "overview" | "line-items" | "assumptions" | "clarifications" | "exclusions" | "compliance";

const TABS: { id: Tab; label: string; count?: number }[] = [
  { id: "overview", label: "Overview" },
  { id: "line-items", label: "Line Items", count: 5 },
  { id: "assumptions", label: "Assumptions", count: 4 },
  { id: "clarifications", label: "Clarifications", count: 4 },
  { id: "exclusions", label: "Exclusions", count: 6 },
  { id: "compliance", label: "Compliance" },
];

export default function BidEditorPage() {
  const [tab, setTab] = useState<Tab>("overview");
  const [bid] = useState(DEMO_BID);

  return (
    <div className="flex min-h-screen flex-col">
      {/* Top bar */}
      <div className="border-b border-slate-200 bg-white px-6 py-3 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="text-slate-500 hover:text-slate-900 dark:hover:text-slate-100">
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-slate-400" />
                <h1 className="font-medium text-slate-900 dark:text-slate-100">{bid.projectName}</h1>
                <span className="badge-amber">In Review</span>
              </div>
              <div className="mt-0.5 text-xs text-slate-500">
                {bid.gcName} · {bid.itbFileName} · Deadline {new Date(bid.bidDeadline).toLocaleDateString()}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button className="btn-secondary px-3 py-1.5 text-sm">
              <Download className="h-4 w-4" />
              Export
            </button>
            <button className="btn-primary px-3 py-1.5 text-sm">
              <Send className="h-4 w-4" />
              Mark submitted
            </button>
          </div>
        </div>
      </div>

      {/* Warnings banner */}
      {bid.warnings.length > 0 && (
        <div className="border-b border-amber-200 bg-amber-50 px-6 py-3 dark:border-amber-900/50 dark:bg-amber-950/20">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-600" />
            <div>
              <div className="text-sm font-medium text-amber-900 dark:text-amber-100">
                {bid.warnings.length} {bid.warnings.length === 1 ? "item" : "items"} need your review before submitting
              </div>
              <ul className="mt-1 space-y-0.5 text-sm text-amber-800 dark:text-amber-200">
                {bid.warnings.map((w, i) => (
                  <li key={i}>• {w}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Split view: PDF viewer + editor */}
      <div className="flex flex-1">
        {/* PDF preview column */}
        <div className="hidden w-96 flex-shrink-0 border-r border-slate-200 bg-slate-100 xl:block dark:border-slate-800 dark:bg-slate-950/50">
          <div className="border-b border-slate-200 px-4 py-2 text-xs font-medium text-slate-500 dark:border-slate-800">
            SOURCE PDF
          </div>
          <div className="p-4 text-center text-sm text-slate-500">
            <div className="mx-auto max-w-[240px]">
              <div className="aspect-[8.5/11] rounded border border-slate-300 bg-white shadow-soft dark:border-slate-700 dark:bg-slate-800">
                <div className="p-6 text-left text-[10px] leading-relaxed">
                  <div className="mb-3 font-semibold text-slate-900 dark:text-slate-100">INVITATION TO BID</div>
                  <div className="text-slate-500">Project: Downtown Office...</div>
                  <div className="mt-3 text-slate-500">
                    3.1 Electrical Scope — Contractor shall provide all labor,
                    material, equipment...
                  </div>
                </div>
              </div>
              <div className="mt-3 text-xs text-slate-500">Page 3 of 12</div>
              <div className="mt-3 text-xs text-slate-400">
                Click any line item to jump to its source page.
              </div>
            </div>
          </div>
        </div>

        {/* Editor column */}
        <div className="flex-1 bg-white dark:bg-slate-950">
          {/* Tabs */}
          <div className="border-b border-slate-200 px-6 dark:border-slate-800">
            <div className="flex gap-1">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={cn(
                    "border-b-2 px-3 py-3 text-sm font-medium transition-colors",
                    tab === t.id
                      ? "border-amber-500 text-slate-900 dark:text-slate-100"
                      : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200",
                  )}
                >
                  {t.label}
                  {t.count !== undefined && (
                    <span className="ml-1.5 text-xs text-slate-400">{t.count}</span>
                  )}
                </button>
              ))}
            </div>
          </div>

          <div className="p-6">
            {tab === "overview" && <OverviewTab bid={bid} />}
            {tab === "line-items" && <LineItemsTab bid={bid} />}
            {tab === "assumptions" && <ListTab items={bid.assumptions} label="Assumption" />}
            {tab === "clarifications" && <ListTab items={bid.clarifications} label="Clarification" />}
            {tab === "exclusions" && <ListTab items={bid.exclusions} label="Exclusion" />}
            {tab === "compliance" && <ComplianceTab />}
          </div>
        </div>
      </div>
    </div>
  );
}

function OverviewTab({ bid }: { bid: typeof DEMO_BID }) {
  return (
    <div className="max-w-3xl space-y-8">
      <div className="grid grid-cols-2 gap-6">
        <Field label="Project" value={bid.projectName} />
        <Field label="General Contractor" value={bid.gcName} />
        <Field label="Primary Trade" value={bid.primaryTrade} />
        <Field label="Bid Deadline" value={new Date(bid.bidDeadline).toLocaleDateString("en-US", { dateStyle: "full" })} />
      </div>

      <div>
        <h3 className="mb-3 text-sm font-medium uppercase tracking-wider text-slate-500">Summary</h3>
        <div className="grid grid-cols-4 gap-4">
          <MiniStat label="Line items" value="5" />
          <MiniStat label="Assumptions" value="4" />
          <MiniStat label="Clarifications" value="4" />
          <MiniStat label="Exclusions" value="6" />
        </div>
      </div>

      <div>
        <h3 className="mb-3 text-sm font-medium uppercase tracking-wider text-slate-500">Pricing (once entered)</h3>
        <div className="rounded-lg border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500 dark:border-slate-700">
          Fill in unit costs on the <button className="text-amber-600 underline">Line Items</button> tab to see totals here.
        </div>
      </div>
    </div>
  );
}

function LineItemsTab({ bid }: { bid: typeof DEMO_BID }) {
  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-slate-500">
          Confidence: <span className="badge-green mr-1">high</span> <span className="badge-amber mr-1">check</span> <span className="badge-red">verify</span> — click any row to jump to the source page.
        </p>
        <button className="btn-secondary px-3 py-1.5 text-sm">
          <Plus className="h-4 w-4" />
          Add line item
        </button>
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 dark:border-slate-800">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-900/50">
            <tr>
              <th className="w-8 px-3 py-2"></th>
              <th className="px-3 py-2 font-medium">Description</th>
              <th className="w-20 px-3 py-2 font-medium">Qty</th>
              <th className="w-16 px-3 py-2 font-medium">Unit</th>
              <th className="w-32 px-3 py-2 font-medium">Unit cost</th>
              <th className="w-32 px-3 py-2 font-medium">Total</th>
              <th className="w-24 px-3 py-2 font-medium">Conf.</th>
              <th className="w-8 px-3 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {bid.lineItems.map((li) => (
              <tr key={li.id} className="group hover:bg-slate-50 dark:hover:bg-slate-900/50">
                <td className="px-3 py-2 text-slate-300">
                  <GripVertical className="h-4 w-4 cursor-grab" />
                </td>
                <td className="px-3 py-2">
                  <div className="font-medium text-slate-900 dark:text-slate-100">{li.description}</div>
                  {li.sourcePage && (
                    <div className="mt-0.5 text-xs text-slate-400">
                      p.{li.sourcePage}
                    </div>
                  )}
                </td>
                <td className="px-3 py-2 font-mono text-slate-600 dark:text-slate-400">{li.quantity.toLocaleString()}</td>
                <td className="px-3 py-2 text-slate-600 dark:text-slate-400">{li.unit}</td>
                <td className="px-3 py-2">
                  <input className="input w-full py-1 font-mono" placeholder="$0.00" />
                </td>
                <td className="px-3 py-2 font-mono text-slate-600 dark:text-slate-400">$0.00</td>
                <td className="px-3 py-2">
                  <span className={confidenceClass(li.confidence)}>
                    {(li.confidence * 100).toFixed(0)}%
                  </span>
                </td>
                <td className="px-3 py-2">
                  <button className="text-slate-300 opacity-0 hover:text-red-600 group-hover:opacity-100">
                    <X className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900/50">
            <tr>
              <td colSpan={5} className="px-3 py-3 text-right text-sm text-slate-500">Subtotal</td>
              <td className="px-3 py-3 font-mono font-semibold text-slate-900 dark:text-slate-100">$0.00</td>
              <td colSpan={2}></td>
            </tr>
            <tr>
              <td colSpan={5} className="px-3 py-2 text-right text-sm text-slate-500">Overhead (10%)</td>
              <td className="px-3 py-2 font-mono text-slate-600">$0.00</td>
              <td colSpan={2}></td>
            </tr>
            <tr>
              <td colSpan={5} className="px-3 py-2 text-right text-sm text-slate-500">Profit (10%)</td>
              <td className="px-3 py-2 font-mono text-slate-600">$0.00</td>
              <td colSpan={2}></td>
            </tr>
            <tr>
              <td colSpan={5} className="px-3 py-3 text-right text-sm font-semibold text-slate-900 dark:text-slate-100">Total bid</td>
              <td className="px-3 py-3 font-mono text-lg font-bold text-slate-900 dark:text-slate-100">$0.00</td>
              <td colSpan={2}></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

function ListTab({ items, label }: { items: string[]; label: string }) {
  return (
    <div className="max-w-3xl space-y-2">
      {items.map((item, i) => (
        <div key={i} className="group flex items-start gap-3 rounded-lg border border-slate-200 bg-white p-4 hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900">
          <div className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md bg-slate-100 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-400">
            {i + 1}
          </div>
          <div className="flex-1 text-sm text-slate-800 dark:text-slate-200">{item}</div>
          <button className="text-slate-300 opacity-0 hover:text-red-600 group-hover:opacity-100">
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
      <button className="btn-secondary w-full px-3 py-2 text-sm">
        <Plus className="h-4 w-4" />
        Add {label.toLowerCase()}
      </button>
    </div>
  );
}

function ComplianceTab() {
  return (
    <div className="max-w-3xl space-y-6">
      <ComplianceItem label="Bond" value="Required — 10% of bid" status="check" />
      <ComplianceItem label="Insurance" value="$2M GL, $5M umbrella, Workers' Comp" status="ok" />
      <ComplianceItem label="Prevailing wage" value="Not required" status="ok" />
      <ComplianceItem label="Davis-Bacon" value="Not applicable" status="ok" />
      <ComplianceItem label="Prequalification" value="Required — submit form by 07/22" status="warn" />
    </div>
  );
}

function ComplianceItem({ label, value, status }: { label: string; value: string; status: "ok" | "warn" | "check" }) {
  const cls = status === "ok" ? "badge-green" : status === "warn" ? "badge-amber" : "badge-slate";
  const text = status === "ok" ? "Confirmed" : status === "warn" ? "Action needed" : "Verify";
  return (
    <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <div>
        <div className="text-sm font-medium text-slate-900 dark:text-slate-100">{label}</div>
        <div className="mt-0.5 text-sm text-slate-500">{value}</div>
      </div>
      <span className={cls}>{text}</span>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs font-medium uppercase tracking-wider text-slate-500">{label}</div>
      <div className="mt-1 text-sm text-slate-900 dark:text-slate-100">{value}</div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900">
      <div className="text-2xl font-semibold text-slate-900 dark:text-slate-100">{value}</div>
      <div className="mt-0.5 text-xs text-slate-500">{label}</div>
    </div>
  );
}
