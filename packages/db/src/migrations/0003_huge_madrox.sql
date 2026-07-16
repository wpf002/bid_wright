CREATE TABLE IF NOT EXISTS "templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"trade" text,
	"assumptions" jsonb NOT NULL,
	"clarifications" jsonb NOT NULL,
	"exclusions" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_clauses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"trade" text,
	"text" text NOT NULL,
	"use_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "cost_history" ADD COLUMN "normalized_key" text DEFAULT '' NOT NULL;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "templates" ADD CONSTRAINT "templates_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_clauses" ADD CONSTRAINT "user_clauses_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "templates_user_idx" ON "templates" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_clauses_user_kind_idx" ON "user_clauses" USING btree ("user_id","kind");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_clauses_user_trade_idx" ON "user_clauses" USING btree ("user_id","trade");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "cost_history_match_idx" ON "cost_history" USING btree ("user_id","trade","normalized_key");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "cost_history_bid_item_idx" ON "cost_history" USING btree ("bid_id","normalized_key","unit");