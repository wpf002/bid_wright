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

export {
  decidedBids,
  winRateByCounterparty,
  winRateByTrade,
  overallWinRate,
  averageBidToAwardDays,
  averageMarginPercent,
  lossReasons,
  winRateTrend,
  historyWith,
  summarize,
} from "./intelligence/analytics";
export type {
  AnalyticsBid,
  AnalyticsSummary,
  WinRate,
  ReasonCount,
  TrendPoint,
  CounterpartyHistory,
} from "./intelligence/analytics";

export { choosePdf, scoreAttachment, normalizeFileName } from "./inbox/choose-pdf";
export type { PdfChoice, ScoredAttachment } from "./inbox/choose-pdf";

export {
  planSupportingUploads,
  describeSkipped,
  DEFAULT_SUPPORTING_LIMITS,
  MAX_SUPPORTING_FILE_BYTES,
  MAX_SUPPORTING_TOTAL_BYTES,
  MAX_SUPPORTING_FILES,
} from "./inbox/supporting-budget";
export type { SupportingLimits, SupportingPlan, SkippedAttachment } from "./inbox/supporting-budget";

export {
  detectItb,
  isPdf,
  itbClassifierPrompt,
  parseClassifierReply,
  ITB_THRESHOLD,
  UNCERTAIN_THRESHOLD,
} from "./inbox/detect";
export type {
  InboundEmail,
  InboundAttachment,
  DetectionResult,
  Classification,
  DetectOptions,
} from "./inbox/detect";

export * from "./types";
