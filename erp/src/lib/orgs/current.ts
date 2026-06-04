import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { and, eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { orgMembers, organizations, type OrgRole } from "@/lib/db/schema";
import { getCurrentUser } from "@/lib/auth/session";

export const ACTIVE_ORG_COOKIE = "quill_active_org";

export interface CurrentOrg {
  org: typeof organizations.$inferSelect;
  role: OrgRole;
}

/**
 * Resolve the org the user is currently operating in.
 *
 * Resolution order:
 *   1. ACTIVE_ORG_COOKIE — if set AND the user is a member of that org
 *   2. Their first membership (deterministic by created_at) — used for
 *      single-org accounts and as the bootstrap default
 *   3. null — they belong to no org (first-time signup; show bootstrap UI)
 *
 * Memoized per request so every Server Component on the page can call
 * this without piling on round-trips.
 */
export const getCurrentOrg = cache(async (): Promise<CurrentOrg | null> => {
  const user = await getCurrentUser();
  if (!user) return null;

  const cookieStore = await cookies();
  const cookieOrgId = cookieStore.get(ACTIVE_ORG_COOKIE)?.value;

  // Single query covers both cases: pull every membership the user has,
  // then prefer the cookie's pick when present, else first by createdAt.
  const memberships = await db
    .select({
      role: orgMembers.role,
      org: organizations,
      createdAt: orgMembers.createdAt,
    })
    .from(orgMembers)
    .innerJoin(organizations, eq(organizations.id, orgMembers.orgId))
    .where(eq(orgMembers.userId, user.id))
    .orderBy(orgMembers.createdAt);

  if (memberships.length === 0) return null;

  const preferred =
    (cookieOrgId &&
      memberships.find((m) => m.org.id === cookieOrgId)) ||
    memberships[0];

  return { org: preferred.org, role: preferred.role };
});

/**
 * List every org the current user is a member of, with their role.
 * Used by the org switcher; cheap because everything is indexed on
 * (org_id, user_id).
 */
export const listMyOrgs = cache(async () => {
  const user = await getCurrentUser();
  if (!user) return [];

  return db
    .select({
      org: organizations,
      role: orgMembers.role,
    })
    .from(orgMembers)
    .innerJoin(organizations, eq(organizations.id, orgMembers.orgId))
    .where(eq(orgMembers.userId, user.id))
    .orderBy(organizations.name);
});

/**
 * Defensive check used by /api/orgs/active before honoring a switch
 * request — proves the user actually belongs to the org they're
 * trying to switch into.
 */
export async function isMember(userId: string, orgId: string) {
  const rows = await db
    .select({ role: orgMembers.role })
    .from(orgMembers)
    .where(and(eq(orgMembers.userId, userId), eq(orgMembers.orgId, orgId)))
    .limit(1);
  return rows[0]?.role ?? null;
}
