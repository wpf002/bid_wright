CREATE TABLE IF NOT EXISTS "inbound_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"message_id" text NOT NULL,
	"from_address" text NOT NULL,
	"subject" text NOT NULL,
	"classification" text NOT NULL,
	"score" integer DEFAULT 0 NOT NULL,
	"reasons" jsonb NOT NULL,
	"bid_id" uuid,
	"error" text,
	"received_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "inbound_token" text;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inbound_messages" ADD CONSTRAINT "inbound_messages_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inbound_messages" ADD CONSTRAINT "inbound_messages_bid_id_bids_id_fk" FOREIGN KEY ("bid_id") REFERENCES "public"."bids"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "inbound_messages_user_idx" ON "inbound_messages" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "inbound_messages_user_message_idx" ON "inbound_messages" USING btree ("user_id","message_id");--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_inbound_token_unique" UNIQUE("inbound_token");