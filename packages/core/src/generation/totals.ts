import type { BidLineItem, BidResponse, Cents } from "@bidwright/shared";
import { sumCents, applyPercent, lineItemTotalCents } from "@bidwright/shared";

export interface BidTotals {
  subtotalCents: Cents;
  overheadCents: Cents;
  profitCents: Cents;
  totalCents: Cents;
}

/**
 * Overhead and profit are each taken as a percentage of the subtotal (not
 * compounded on one another), which is how subs typically quote "10 and 10".
 * All arithmetic stays in integer cents.
 */
export function computeBidTotals(
  lineItems: BidLineItem[],
  overheadPercent: number,
  profitPercent: number,
): BidTotals {
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

/** Recompute every line item total from quantity x unit cost, then the bid totals. */
export function recalculateBid(bid: BidResponse): BidResponse {
  const lineItems = bid.lineItems.map((li) => ({
    ...li,
    totalCostCents: lineItemTotalCents(li.quantity, li.unitCostCents),
  }));
  const { subtotalCents, totalCents } = computeBidTotals(
    lineItems,
    bid.overheadPercent,
    bid.profitPercent,
  );
  return { ...bid, lineItems, subtotalCents, totalCents };
}
