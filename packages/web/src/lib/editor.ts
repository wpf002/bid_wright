import type { BidLineItem } from "@bidwright/shared";
import { lineItemTotalCents, sumCents, applyPercent } from "@bidwright/shared";

/**
 * Pure editor logic. Money never round-trips through a float: user input is
 * parsed straight to integer cents, and totals are recomputed from those.
 */

/**
 * Parse a user-typed dollar amount ("12.50", "$1,250", "12.5") into integer
 * cents. Returns null for anything that isn't a usable number.
 */
export function parseDollarsToCents(input: string): number | null {
  const cleaned = input.trim().replace(/[$,\s]/g, "");
  if (cleaned === "") return 0;
  if (!/^-?\d*\.?\d*$/.test(cleaned)) return null;
  const value = Number(cleaned);
  if (!Number.isFinite(value)) return null;
  // Round on the cent, not the float: 12.345 -> 1235 (not 1234.4999…).
  return Math.round(value * 100);
}

/** Format integer cents for an editable input — no currency symbol. */
export function formatCentsForInput(cents: number): string {
  return (cents / 100).toFixed(2);
}

/** Parse a user-typed quantity. Blank means 0; junk means null. */
export function parseQuantity(input: string): number | null {
  const cleaned = input.trim().replace(/,/g, "");
  if (cleaned === "") return 0;
  if (!/^-?\d*\.?\d*$/.test(cleaned)) return null;
  const value = Number(cleaned);
  return Number.isFinite(value) && value >= 0 ? value : null;
}

export interface EditableBid {
  lineItems: BidLineItem[];
  assumptions: string[];
  clarifications: string[];
  exclusions: string[];
  overheadPercent: number;
  profitPercent: number;
  validityDays: number;
}

export interface Totals {
  subtotalCents: number;
  overheadCents: number;
  profitCents: number;
  totalCents: number;
}

/** Recompute a line's total from its quantity and unit cost. */
export function withRecalculatedTotal(item: BidLineItem): BidLineItem {
  return { ...item, totalCostCents: lineItemTotalCents(item.quantity, item.unitCostCents) };
}

export function computeTotals(
  lineItems: BidLineItem[],
  overheadPercent: number,
  profitPercent: number,
): Totals {
  const subtotalCents = sumCents(lineItems.map((li) => li.totalCostCents));
  const overheadCents = applyPercent(subtotalCents, overheadPercent);
  const profitCents = applyPercent(subtotalCents, profitPercent);
  return {
    subtotalCents,
    overheadCents,
    profitCents,
    totalCents: subtotalCents + overheadCents + profitCents,
  };
}

/** How many line items still need a price — drives the "unpriced" nudge. */
export function unpricedCount(lineItems: BidLineItem[]): number {
  return lineItems.filter((li) => li.unitCostCents === 0).length;
}

/** Move an item within a list, returning a new array (drag-to-reorder). */
export function reorder<T>(list: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) return list;
  const next = [...list];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

export function blankLineItem(id: string): BidLineItem {
  return {
    id,
    description: "",
    quantity: 1,
    unit: "LS",
    unitCostCents: 0,
    totalCostCents: 0,
    notes: null,
    sourcePage: null,
    confidence: null,
  };
}

/** True when the two bids differ in any field the editor can change. */
export function hasChanges(a: EditableBid, b: EditableBid): boolean {
  return JSON.stringify(a) !== JSON.stringify(b);
}

/** Confidence badge tone. null means the estimator hasn't priced it yet. */
export function confidenceTone(confidence: number | null): "high" | "medium" | "low" | "none" {
  if (confidence === null) return "none";
  if (confidence >= 0.8) return "high";
  if (confidence >= 0.6) return "medium";
  return "low";
}
