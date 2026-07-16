import {
  pgTable, uuid, text, timestamp, integer, real, boolean, index,
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

/** User's own history of unit costs by description — the intelligence layer. */
export const costHistory = pgTable(
  "cost_history",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
    description: text("description").notNull(),
    trade: text("trade").notNull(),
    unit: text("unit").notNull(),
    unitCostCents: integer("unit_cost_cents").notNull(),
    bidId: uuid("bid_id").references(() => bids.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => ({
    userTradeIdx: index("cost_history_user_trade_idx").on(t.userId, t.trade),
  }),
);

/** Reusable exclusion clauses per user, per trade. */
export const exclusionClauses = pgTable("exclusion_clauses", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  trade: text("trade"),
  clause: text("clause").notNull(),
  isDefault: boolean("is_default").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
