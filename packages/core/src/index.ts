export { extractFromPdf, extractFromPages, parseExtractionResponse, extractJsonBlock } from "./extraction/extract";
export type { MessagesClient } from "./extraction/extract";
export { parsePdf, assemblePages, pagesToText, renderTextContent } from "./extraction/pdf";
export type { PdfPage, ParsedPdf } from "./extraction/pdf";
export { classifyTrade, parseTradeReply } from "./extraction/classify";
export {
  validateExtraction,
  normalizeTrade,
  dominantTrade,
  extractionCoreSchema,
  scopeItemSchema,
  TRADE_SLUGS,
} from "./extraction/schema";
export type { ExtractionCore } from "./extraction/schema";

export {
  generateBidResponse,
  parseGenerationResponse,
  draftToLineItems,
  draftToBidResponse,
} from "./generation/generate";
export { validateGenerationDraft, generationDraftSchema, draftLineItemSchema } from "./generation/schema";
export type { GenerationDraft, DraftLineItem } from "./generation/schema";
export { computeBidTotals, recalculateBid } from "./generation/totals";
export type { BidTotals } from "./generation/totals";

export {
  ASSUMPTION_LIBRARY,
  CLARIFICATION_LIBRARY,
  EXCLUSION_LIBRARY,
  forTrade,
  textsForTrade,
} from "./libraries";
export type { ClauseSeed } from "./libraries";

export {
  normalizeDescription,
  normalizeUnit,
  tokenize,
  similarity,
  suggestCost,
  suggestCostsForItems,
  toCostRecord,
  SIMILARITY_THRESHOLD,
} from "./intelligence/matching";
export type { CostRecord, CostSuggestion } from "./intelligence/matching";

export * from "./types";
