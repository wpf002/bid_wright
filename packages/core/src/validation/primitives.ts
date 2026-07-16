import { z } from "zod";

/** Shared zod building blocks for validating model output. */

/** "" / undefined / null all collapse to null; anything else stringifies. */
export const nullableString = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((v) => (v == null || v === "" ? null : String(v)))
  .catch(null);

/** An array of non-empty, trimmed strings. Non-arrays degrade to []. */
export const stringArray = z
  .array(z.string())
  .catch([])
  .transform((arr) => arr.map((s) => s.trim()).filter(Boolean));

/** A 0..1 confidence, clamped rather than rejected. */
export const confidenceSchema = z
  .number()
  .catch(0.5)
  .transform((n) => Math.min(1, Math.max(0, n)));

/** A nullable number that tolerates junk. */
export const nullableNumber = z
  .union([z.number(), z.null(), z.undefined()])
  .transform((v) => (typeof v === "number" && Number.isFinite(v) ? v : null))
  .catch(null);

/** A nullable 1-indexed page number. */
export const nullablePageNumber = z
  .union([z.number(), z.null(), z.undefined()])
  .transform((v) => (typeof v === "number" && v > 0 && Number.isFinite(v) ? Math.floor(v) : null))
  .catch(null);

/** A percent in 0..100, clamped. */
export function percentSchema(fallback: number) {
  return z
    .number()
    .catch(fallback)
    .transform((n) => (Number.isFinite(n) ? Math.min(100, Math.max(0, n)) : fallback));
}

/** A positive integer with a fallback (e.g. validity days). */
export function positiveIntSchema(fallback: number) {
  return z
    .number()
    .catch(fallback)
    .transform((n) => (Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback));
}
