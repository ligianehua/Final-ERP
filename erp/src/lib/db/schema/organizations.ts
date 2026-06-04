import {
  pgEnum,
  pgTable,
  text,
  uuid,
  uniqueIndex,
  char,
} from "drizzle-orm/pg-core";
import { pk, timestamps } from "./_shared";
import { currencies } from "./currencies";

/**
 * RBAC roles for org_members. Application-layer authorization in
 * src/lib/rbac uses this enum exclusively — no Supabase RLS.
 *
 * Ordering reflects rough scope: org_admin > sales|purchasing|warehouse
 * > viewer. Don't reorder; values are stored as strings.
 */
export const orgRole = pgEnum("org_role", [
  "org_admin",
  "sales",
  "purchasing",
  "warehouse",
  "viewer",
]);

export type OrgRole = (typeof orgRole.enumValues)[number];

/**
 * A legal/operational entity. One Supabase auth user can belong to
 * many organizations via `org_members`; every business table (items,
 * warehouses, parties, …) is scoped by `org_id`.
 *
 * `base_currency` is the org's reporting/home currency — multi-currency
 * docs convert to this for ledgers and reports.
 */
export const organizations = pgTable("organizations", {
  id: pk(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  baseCurrency: char("base_currency", { length: 3 })
    .notNull()
    .references(() => currencies.code, { onUpdate: "cascade" })
    .default("CNY"),
  /** IANA timezone name; falls back to UTC at the app layer if null. */
  timezone: text("timezone").notNull().default("Asia/Shanghai"),
  ...timestamps(),
});

export type Organization = typeof organizations.$inferSelect;
export type NewOrganization = typeof organizations.$inferInsert;

/**
 * Who can see/modify what inside an organization. (user_id, org_id) is
 * unique — a user holds exactly one role per org. Multi-role users
 * are out of scope for v1; revisit when the UX demands it.
 */
export const orgMembers = pgTable(
  "org_members",
  {
    id: pk(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    /** Supabase auth.users.id — referenced by id, not via FK (auth schema is managed) */
    userId: uuid("user_id").notNull(),
    role: orgRole("role").notNull().default("viewer"),
    ...timestamps(),
  },
  (t) => [uniqueIndex("org_members_org_user_uidx").on(t.orgId, t.userId)],
);

export type OrgMember = typeof orgMembers.$inferSelect;
