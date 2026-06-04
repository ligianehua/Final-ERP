import { sql } from "drizzle-orm";
import {
  pgEnum,
  pgTable,
  text,
  uuid,
  boolean,
  index,
  uniqueIndex,
  primaryKey,
} from "drizzle-orm/pg-core";
import { pk, timestamps } from "./_shared";
import { organizations } from "./organizations";

/**
 * Whether the party is treated as a legal entity or a single human.
 * Drives which fields the UI surfaces (TIN vs personal ID, etc.).
 */
export const partyKind = pgEnum("party_kind", ["company", "individual"]);

/**
 * A party can play multiple roles simultaneously — e.g. a freelancer
 * you both buy from and sell to. We store roles in a join table rather
 * than flags on `parties` so adding a new role (employee, lender, …)
 * doesn't require an ALTER TABLE.
 */
export const partyRole = pgEnum("party_role", ["customer", "vendor"]);

export const addressType = pgEnum("address_type", [
  "billing",
  "shipping",
  "registered",
  "other",
]);

/**
 * Customers / vendors / both. Org-scoped — the same supplier across
 * two organizations is two rows; that's intentional, each org owns
 * its own commercial terms.
 */
export const parties = pgTable(
  "parties",
  {
    id: pk(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    kind: partyKind("kind").notNull(),
    /** Display name. For companies: legal name. For individuals: full name. */
    name: text("name").notNull(),
    /** Short reference, e.g. invoice header — optional. */
    shortName: text("short_name"),
    /** Tax ID — generic; format varies by region. */
    taxId: text("tax_id"),
    notes: text("notes"),
    ...timestamps(),
  },
  (t) => [
    index("parties_org_idx").on(t.orgId),
    index("parties_org_name_idx").on(t.orgId, t.name),
  ],
);

export type Party = typeof parties.$inferSelect;

/**
 * Composite PK (party_id, role) lets a party be both customer and vendor.
 */
export const partyRoles = pgTable(
  "party_roles",
  {
    partyId: uuid("party_id")
      .notNull()
      .references(() => parties.id, { onDelete: "cascade" }),
    role: partyRole("role").notNull(),
    ...timestamps(),
  },
  (t) => [primaryKey({ columns: [t.partyId, t.role] })],
);

export const partyAddresses = pgTable(
  "party_addresses",
  {
    id: pk(),
    partyId: uuid("party_id")
      .notNull()
      .references(() => parties.id, { onDelete: "cascade" }),
    type: addressType("type").notNull().default("other"),
    label: text("label"),
    line1: text("line1"),
    line2: text("line2"),
    city: text("city"),
    region: text("region"),
    postalCode: text("postal_code"),
    /** ISO 3166-1 alpha-2 — keep as text to allow ad-hoc codes. */
    country: text("country"),
    isDefault: boolean("is_default").notNull().default(false),
    ...timestamps(),
  },
  (t) => [index("party_addresses_party_idx").on(t.partyId)],
);

export const partyContacts = pgTable(
  "party_contacts",
  {
    id: pk(),
    partyId: uuid("party_id")
      .notNull()
      .references(() => parties.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    title: text("title"),
    email: text("email"),
    phone: text("phone"),
    notes: text("notes"),
    ...timestamps(),
  },
  (t) => [
    index("party_contacts_party_idx").on(t.partyId),
    uniqueIndex("party_contacts_party_email_uidx")
      .on(t.partyId, t.email)
      .where(sql`email IS NOT NULL`),
  ],
);
