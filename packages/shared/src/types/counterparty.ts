/**
 * Who the bid goes to.
 *
 * On private work that's the general contractor. On public work there is no GC
 * — the agency solicits subs directly — and all seven real federal ITBs we
 * tested extracted a GC of null, because none of them had one. Keying the board
 * and the analytics off gcName alone meant public bids showed "—" in the GC
 * column and every one of them collapsed into a single "Unknown GC" bucket,
 * which is worse than useless: it reads as missing data when the data isn't
 * missing.
 *
 * gcName and ownerName stay separate in the database — they are different
 * facts, and an earlier version that conflated them produced values like
 * "Owner: Dallas ISD; GC: Turner Ridge" in one field. This resolves them at the
 * point of display instead.
 */
export interface CounterpartyRef {
  gcName: string | null;
  ownerName: string | null;
}

export interface Counterparty {
  name: string;
  /** Which field it came from — the UI labels a public agency differently. */
  kind: "gc" | "owner";
}

function clean(v: string | null | undefined): string | null {
  const t = v?.trim();
  return t ? t : null;
}

/**
 * The GC wins when present: on private work you bid to the GC even though the
 * owner is named in the ITB. The owner is the fallback, not the equal.
 */
export function counterparty(bid: CounterpartyRef): Counterparty | null {
  const gc = clean(bid.gcName);
  if (gc) return { name: gc, kind: "gc" };

  const owner = clean(bid.ownerName);
  if (owner) return { name: owner, kind: "owner" };

  return null;
}

/** Display name for the board, with an honest fallback. */
export function counterpartyName(bid: CounterpartyRef, fallback = "—"): string {
  return counterparty(bid)?.name ?? fallback;
}
