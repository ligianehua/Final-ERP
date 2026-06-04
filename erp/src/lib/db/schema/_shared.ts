import { sql } from "drizzle-orm";
import { timestamp, uuid } from "drizzle-orm/pg-core";

/**
 * Columns every domain table carries. Spread into table definitions.
 *
 *   export const foo = pgTable("foo", { ...timestamps(), name: text() })
 *
 * `created_at` / `updated_at` are stored with timezone; clients send
 * UTC, the DB stores UTC, the app converts to org timezone on read.
 */
export function timestamps() {
  return {
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  };
}

/** Primary-key column shared across domain tables. */
export function pk() {
  return uuid("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`);
}
