import { pgTable, char, text, smallint, boolean } from "drizzle-orm/pg-core";
import { timestamps } from "./_shared";

/**
 * ISO 4217 currencies. The `code` (e.g. "CNY", "USD", "PHP") is the
 * primary key — single source of truth referenced by every monetary
 * column elsewhere.
 *
 * Seeded with CNY / USD / PHP in the 0001 migration; more rows can be
 * inserted by hand or by the migration runner as needed.
 */
export const currencies = pgTable("currencies", {
  code: char("code", { length: 3 }).primaryKey(),
  name: text("name").notNull(),
  symbol: text("symbol").notNull(),
  /** ISO 4217 minor-unit exponent (2 for cents, 0 for JPY, etc.) */
  decimals: smallint("decimals").notNull().default(2),
  active: boolean("active").notNull().default(true),
  ...timestamps(),
});

export type Currency = typeof currencies.$inferSelect;
