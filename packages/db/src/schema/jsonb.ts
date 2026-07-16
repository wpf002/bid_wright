import { customType } from "drizzle-orm/pg-core";

/**
 * A jsonb column that stores real JSON, not a JSON-encoded string.
 *
 * drizzle's built-in `jsonb()` runs JSON.stringify in toDriver, and postgres-js
 * then JSON-encodes that string again — so `{"a":1}` lands in the column as the
 * *string* "{\"a\":1}". The app never noticed (drizzle parses it back on read),
 * but it defeats the point of jsonb: `jsonb_array_length` errors, `->>` returns
 * nothing, and jsonb indexes can't work. The cost-history and win-rate queries
 * in later phases need to reach inside these columns.
 *
 * Passing the value straight through lets postgres-js encode it exactly once.
 */
export const jsonbObject = <TData>(name: string) =>
  customType<{ data: TData; driverData: unknown }>({
    dataType() {
      return "jsonb";
    },
    toDriver(value: TData): unknown {
      return value;
    },
    fromDriver(value: unknown): TData {
      // Rows written before this fix hold a JSON string; decode them so old and
      // new rows both read back as objects.
      if (typeof value === "string") {
        try {
          return JSON.parse(value) as TData;
        } catch {
          return value as TData;
        }
      }
      return value as TData;
    },
  })(name);
