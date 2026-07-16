import {
  pgTable, uuid, text, timestamp, integer, real, index, uniqueIndex,
} from "drizzle-orm/pg-core";
import { jsonbObject as jsonb } from "./jsonb";

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  companyName: text("company_name"),
  primaryTrade: text("primary_trade"),
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
