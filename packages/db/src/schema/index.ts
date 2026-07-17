import {
  pgTable, uuid, text, timestamp, integer, real, boolean, index, uniqueIndex,
} from "drizzle-orm/pg-core";
import { jsonbObject as jsonb } from "./jsonb";

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  companyName: text("company_name"),
  primaryTrade: text("primary_trade"),
  /**
   * Slug for this user's private forwarding address
   * (u-<token>@inbox.bidwright.app). Unguessable, because anyone who knows it
   * can put bids on this user's board; rotatable for the same reason.
   */
  inboundToken: text("inbound_token").unique(),

  // ---- company profile: what appears on an exported proposal --------------
  /** Storage key for the letterhead image; served through an owner-scoped route. */
  logoStoragePath: text("logo_storage_path"),
  /** Hex like #d97706. Tinted rules and headings on the proposal. */
  brandColor: text("brand_color"),
  companyAddress: text("company_address"),
  companyPhone: text("company_phone"),
  companyEmail: text("company_email"),
  /** Licence number — subs are usually required to show it on a proposal. */
  companyLicense: text("company_license"),
  /** Payment/validity boilerplate appended to every proposal. */
  proposalTerms: text("proposal_terms"),

  createdAt: timestamp("created_at").notNull().defaultNow(),
});

/**
 * Refresh tokens, stored as a SHA-256 hash so a database leak can't be replayed.
 * Rotation: using a token revokes it and records the token that replaced it, so
 * a replayed (already-rotated) token is detectable as theft.
 */
export const refreshTokens = pgTable(
  "refresh_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
    tokenHash: text("token_hash").notNull().unique(),
    expiresAt: timestamp("expires_at").notNull(),
    revokedAt: timestamp("revoked_at"),
    /** The token this one was rotated into — presence means it was already used. */
    replacedBy: text("replaced_by"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => ({
    userIdx: index("refresh_tokens_user_idx").on(t.userId),
    hashIdx: index("refresh_tokens_hash_idx").on(t.tokenHash),
  }),
);

export const bids = pgTable(
  "bids",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
    itbFileName: text("itb_file_name").notNull(),
    projectName: text("project_name"),
    /** The GC soliciting the bid — distinct from the project owner. */
    gcName: text("gc_name"),
    ownerName: text("owner_name"),
    bidDeadline: timestamp("bid_deadline"),
    primaryTrade: text("primary_trade"),
    status: text("status").notNull().default("draft"),
    extraction: jsonb("extraction").notNull(),
    lineItems: jsonb("line_items").notNull(),
    assumptions: jsonb("assumptions").notNull(),
    clarifications: jsonb("clarifications").notNull(),
    exclusions: jsonb("exclusions").notNull(),
    subtotalCents: integer("subtotal_cents").notNull().default(0),
    overheadPercent: real("overhead_percent").notNull().default(10),
    profitPercent: real("profit_percent").notNull().default(10),
    totalCents: integer("total_cents").notNull().default(0),
    validityDays: integer("validity_days").notNull().default(30),
    outcome: jsonb("outcome"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => ({
    userIdx: index("bids_user_idx").on(t.userId),
    statusIdx: index("bids_status_idx").on(t.status),
    deadlineIdx: index("bids_deadline_idx").on(t.bidDeadline),
  }),
);

export const uploads = pgTable("uploads", {
  id: uuid("id").primaryKey().defaultRandom(),
  bidId: uuid("bid_id").references(() => bids.id, { onDelete: "cascade" }),
  fileName: text("file_name").notNull(),
  fileSize: integer("file_size").notNull(),
  storagePath: text("storage_path").notNull(),
  /**
   * The document the bid was extracted from, as opposed to drawings, wage
   * determinations, and addenda that arrived with it.
   *
   * A forwarded ITB carries several PDFs and we keep them all, so "the bid's
   * PDF" stops being a synonym for "the bid's only upload" — every read of
   * this table has to say which one it means. Defaults true because every row
   * that existed before we kept supporting files was the primary.
   */
  isPrimary: boolean("is_primary").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

/**
 * The user's own history of unit costs by description — the intelligence layer.
 * One row per priced line item on a finalized bid.
 */
export const costHistory = pgTable(
  "cost_history",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
    description: text("description").notNull(),
    /**
     * Canonical form of the description (see normalizeDescription). Stored
     * rather than computed so matching is an indexed lookup instead of a
     * full scan of the user's history on every line item.
     */
    normalizedKey: text("normalized_key").notNull().default(""),
    trade: text("trade").notNull(),
    unit: text("unit").notNull(),
    unitCostCents: integer("unit_cost_cents").notNull(),
    bidId: uuid("bid_id").references(() => bids.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => ({
    userTradeIdx: index("cost_history_user_trade_idx").on(t.userId, t.trade),
    matchIdx: index("cost_history_match_idx").on(t.userId, t.trade, t.normalizedKey),
    /** One row per line item per bid — makes re-finalizing idempotent. */
    uniquePerBidItem: uniqueIndex("cost_history_bid_item_idx").on(t.bidId, t.normalizedKey, t.unit),
  }),
);

/**
 * The user's own reusable clauses. Supersedes the exclusion-only table:
 * Phase 4 needs assumptions and clarifications too, and they behave
 * identically apart from `kind`.
 */
export const userClauses = pgTable(
  "user_clauses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
    /** "assumption" | "clarification" | "exclusion" */
    kind: text("kind").notNull(),
    /** Null means the clause applies to every trade. */
    trade: text("trade"),
    text: text("text").notNull(),
    /** Bumped on insert, so the picker can surface what this user actually uses. */
    useCount: integer("use_count").notNull().default(0),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => ({
    userKindIdx: index("user_clauses_user_kind_idx").on(t.userId, t.kind),
    userTradeIdx: index("user_clauses_user_trade_idx").on(t.userId, t.trade),
  }),
);

/**
 * Every email that reached a user's forwarding address, with what we decided
 * and why.
 *
 * Two jobs: dedupe (providers retry webhooks, and a forwarded thread can arrive
 * twice), and an audit trail — when detection misses an ITB or lets one
 * through, the estimator's first question is "what happened to that email?"
 */
export const inboundMessages = pgTable(
  "inbound_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
    /** Provider's Message-ID; the dedupe key. */
    messageId: text("message_id").notNull(),
    fromAddress: text("from_address").notNull(),
    subject: text("subject").notNull(),
    /** "itb" | "not_itb" | "uncertain" */
    classification: text("classification").notNull(),
    score: integer("score").notNull().default(0),
    /** Why we decided that, in plain language. */
    reasons: jsonb("reasons").notNull(),
    /** Set when the message produced a bid. */
    bidId: uuid("bid_id").references(() => bids.id, { onDelete: "set null" }),
    /** Populated when ingestion failed after we accepted the message. */
    error: text("error"),
    receivedAt: timestamp("received_at").notNull().defaultNow(),
  },
  (t) => ({
    userIdx: index("inbound_messages_user_idx").on(t.userId),
    /** One row per message per user — makes webhook retries harmless. */
    uniqueMessage: uniqueIndex("inbound_messages_user_message_idx").on(t.userId, t.messageId),
  }),
);

/** A saved clause set the user can apply to a new bid of the same trade. */
export const templates = pgTable(
  "templates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
    name: text("name").notNull(),
    trade: text("trade"),
    assumptions: jsonb("assumptions").notNull(),
    clarifications: jsonb("clarifications").notNull(),
    exclusions: jsonb("exclusions").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => ({
    userIdx: index("templates_user_idx").on(t.userId),
  }),
);
