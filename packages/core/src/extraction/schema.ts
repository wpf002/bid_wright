import { z } from "zod";
import type { ExtractionResult, Trade } from "@bidwright/shared";

/**
 * Zod schemas for validating the raw JSON the model returns for an extraction.
 *
 * Design: the *structure* is strict (missing `scope`, or `scope` that isn't an
 * array, fails validation and triggers a retry), but individual field *values*
 * are coerced softly (an out-of-range confidence is clamped, an unknown trade
 * slug falls back to "other") so one sloppy field doesn't throw away an
 * otherwise-good extraction.
 */

export const TRADE_SLUGS = [
  "electrical", "plumbing", "hvac", "drywall", "framing", "concrete",
  "roofing", "flooring", "painting", "masonry", "demolition", "earthwork",
  "steel", "glazing", "insulation", "fire_protection", "low_voltage",
  "landscaping", "asphalt", "other",
] as const satisfies readonly Trade[];

/** Coerce an arbitrary string into a known trade slug, defaulting to "other". */
export function normalizeTrade(value: unknown): Trade {
  if (typeof value !== "string") return "other";
  const slug = value.trim().toLowerCase().replace(/[\s-]+/g, "_");
  return (TRADE_SLUGS as readonly string[]).includes(slug) ? (slug as Trade) : "other";
}

const tradeSchema = z.unknown().transform(normalizeTrade);

const confidenceSchema = z
  .number()
  .catch(0.5)
  .transform((n) => Math.min(1, Math.max(0, n)));

const nullableString = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((v) => (v == null || v === "" ? null : String(v)))
  .catch(null);

const stringArray = z
  .array(z.string())
  .catch([])
  .transform((arr) => arr.map((s) => s.trim()).filter(Boolean));

export const scopeItemSchema = z.object({
  id: z.union([z.string(), z.number()]).transform(String).catch(""),
  description: z.string().min(1),
  trade: tradeSchema,
  quantity: z.union([z.number(), z.null(), z.undefined()]).transform((v) => (typeof v === "number" ? v : null)).catch(null),
  unit: nullableString,
  notes: nullableString,
  confidence: confidenceSchema,
  sourcePage: z
    .union([z.number(), z.null(), z.undefined()])
    .transform((v) => (typeof v === "number" && v > 0 ? Math.floor(v) : null))
    .catch(null),
});

export const metadataSchema = z.object({
  projectName: nullableString,
  projectAddress: nullableString,
  ownerOrGc: nullableString,
  bidDeadline: nullableString,
  rfiDeadline: nullableString,
  walkthroughDate: nullableString,
  contactName: nullableString,
  contactEmail: nullableString,
  contactPhone: nullableString,
}).partial().transform((m) => ({
  projectName: m.projectName ?? null,
  projectAddress: m.projectAddress ?? null,
  ownerOrGc: m.ownerOrGc ?? null,
  bidDeadline: m.bidDeadline ?? null,
  rfiDeadline: m.rfiDeadline ?? null,
  walkthroughDate: m.walkthroughDate ?? null,
  contactName: m.contactName ?? null,
  contactEmail: m.contactEmail ?? null,
  contactPhone: m.contactPhone ?? null,
}));

export const complianceSchema = z.object({
  bondRequired: z.boolean().catch(false),
  bondPercent: z.union([z.number(), z.null(), z.undefined()]).transform((v) => (typeof v === "number" ? v : null)).catch(null),
  insuranceRequired: z.boolean().catch(false),
  insuranceLimits: stringArray,
  licenseRequirements: stringArray,
  prevailingWage: z.boolean().catch(false),
  unionRequired: z.boolean().catch(false),
  davisBacon: z.boolean().catch(false),
  prequalRequired: z.boolean().catch(false),
  otherRequirements: stringArray,
}).partial().transform((c) => ({
  bondRequired: c.bondRequired ?? false,
  bondPercent: c.bondPercent ?? null,
  insuranceRequired: c.insuranceRequired ?? false,
  insuranceLimits: c.insuranceLimits ?? [],
  licenseRequirements: c.licenseRequirements ?? [],
  prevailingWage: c.prevailingWage ?? false,
  unionRequired: c.unionRequired ?? false,
  davisBacon: c.davisBacon ?? false,
  prequalRequired: c.prequalRequired ?? false,
  otherRequirements: c.otherRequirements ?? [],
}));

/** The shape the model must return (everything except server-appended fields). */
export const extractionCoreSchema = z.object({
  metadata: metadataSchema,
  // Parse each scope item independently and drop the ones that don't validate
  // (e.g. missing a description), rather than failing the whole extraction.
  scope: z.array(z.unknown()).transform((items) =>
    items
      .map((it) => scopeItemSchema.safeParse(it))
      .filter((r): r is z.SafeParseSuccess<z.infer<typeof scopeItemSchema>> => r.success)
      .map((r) => r.data),
  ),
  inclusions: stringArray,
  exclusions: stringArray,
  compliance: complianceSchema,
  primaryTrade: tradeSchema,
  warnings: stringArray,
});

export type ExtractionCore = z.infer<typeof extractionCoreSchema>;

/** ExtractionResult without the fields the server appends after the model call. */
export type ExtractionModelOutput = Omit<ExtractionResult, "rawTextPreview" | "pageCount">;

export interface NormalizeOptions {
  /** Total page count of the source PDF; sourcePage values above this are nulled. */
  pageCount?: number;
}

/**
 * Validate + normalize raw model JSON into a well-formed extraction core.
 * Returns a discriminated result so callers can decide whether to retry.
 */
export function validateExtraction(
  data: unknown,
  opts: NormalizeOptions = {},
): { ok: true; value: ExtractionCore } | { ok: false; error: string } {
  const parsed = extractionCoreSchema.safeParse(data);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") };
  }
  const value = parsed.data;

  // Clamp sourcePage to the real page range and backfill primaryTrade.
  if (opts.pageCount && opts.pageCount > 0) {
    for (const item of value.scope) {
      if (item.sourcePage !== null && item.sourcePage > opts.pageCount) {
        item.sourcePage = null;
      }
    }
  }
  if (value.primaryTrade === "other" && value.scope.length > 0) {
    value.primaryTrade = dominantTrade(value.scope.map((s) => s.trade));
  }
  return { ok: true, value };
}

/** Pick the most common non-"other" trade, or "other" if none. */
export function dominantTrade(trades: Trade[]): Trade {
  const counts = new Map<Trade, number>();
  for (const t of trades) {
    if (t === "other") continue;
    counts.set(t, (counts.get(t) ?? 0) + 1);
  }
  let best: Trade = "other";
  let bestCount = 0;
  for (const [t, c] of counts) {
    if (c > bestCount) {
      best = t;
      bestCount = c;
    }
  }
  return best;
}
