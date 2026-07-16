-- Repair jsonb columns that were written as JSON-encoded strings.
--
-- drizzle's built-in jsonb() stringified the value and postgres-js encoded it
-- again, so these columns held the *string* "{\"a\":1}" instead of {"a":1}.
-- The app round-tripped fine (drizzle parsed on read), but jsonb operators
-- didn't: jsonb_array_length() errored and -> / ->> returned nothing.
--
-- `col #>> '{}'` unwraps a jsonb string back to its text, which then casts to
-- real jsonb. Guarded by jsonb_typeof so it's idempotent and leaves
-- correctly-stored rows alone.

UPDATE "bids" SET "extraction" = ("extraction" #>> '{}')::jsonb WHERE jsonb_typeof("extraction") = 'string';--> statement-breakpoint
UPDATE "bids" SET "line_items" = ("line_items" #>> '{}')::jsonb WHERE jsonb_typeof("line_items") = 'string';--> statement-breakpoint
UPDATE "bids" SET "assumptions" = ("assumptions" #>> '{}')::jsonb WHERE jsonb_typeof("assumptions") = 'string';--> statement-breakpoint
UPDATE "bids" SET "clarifications" = ("clarifications" #>> '{}')::jsonb WHERE jsonb_typeof("clarifications") = 'string';--> statement-breakpoint
UPDATE "bids" SET "exclusions" = ("exclusions" #>> '{}')::jsonb WHERE jsonb_typeof("exclusions") = 'string';--> statement-breakpoint
UPDATE "bids" SET "outcome" = ("outcome" #>> '{}')::jsonb WHERE "outcome" IS NOT NULL AND jsonb_typeof("outcome") = 'string';
