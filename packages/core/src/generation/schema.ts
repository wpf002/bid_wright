import { z } from "zod";
import {
  nullableString,
  stringArray,
  nullablePageNumber,
  percentSchema,
  positiveIntSchema,
} from "../validation/primitives";

/**
 * What the model is asked to return when drafting a bid.
 *
 * Pricing is deliberately absent: the estimator fills in unit costs, so we
 * never let the model invent money. Like the extraction schema, structure is
 * strict but field values coerce softly.
 */

export const draftLineItemSchema = z.object({
  description: z.string().min(1),
  quantity: z
    .number()
    .catch(1)
    .transform((n) => (Number.isFinite(n) && n >= 0 ? n : 1)),
  unit: z
    .string()
    .catch("LS")
    .transform((s) => (s.trim() === "" ? "LS" : s.trim())),
  notes: nullableString,
  sourcePage: nullablePageNumber,
});

export type DraftLineItem = z.infer<typeof draftLineItemSchema>;

export const generationDraftSchema = z.object({
  // Parse line items independently so one malformed entry doesn't sink the draft.
  lineItems: z.array(z.unknown()).transform((items) =>
    items
      .map((it) => draftLineItemSchema.safeParse(it))
      .filter((r): r is z.SafeParseSuccess<DraftLineItem> => r.success)
      .map((r) => r.data),
  ),
  assumptions: stringArray,
  clarifications: stringArray,
  exclusions: stringArray,
  suggestedOverheadPercent: percentSchema(10),
  suggestedProfitPercent: percentSchema(10),
  suggestedValidityDays: positiveIntSchema(30),
});

export type GenerationDraft = z.infer<typeof generationDraftSchema>;

export function validateGenerationDraft(
  data: unknown,
): { ok: true; value: GenerationDraft } | { ok: false; error: string } {
  const parsed = generationDraftSchema.safeParse(data);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "),
    };
  }
  return { ok: true, value: parsed.data };
}
