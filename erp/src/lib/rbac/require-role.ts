import "server-only";
import { getCurrentUser } from "@/lib/auth/session";
import { getCurrentOrg, type CurrentOrg } from "@/lib/orgs/current";
import type { OrgRole } from "@/lib/db/schema";

export class UnauthorizedError extends Error {
  readonly code = "UNAUTHORIZED" as const;
}
export class ForbiddenError extends Error {
  readonly code = "FORBIDDEN" as const;
}
export class NoActiveOrgError extends Error {
  readonly code = "NO_ACTIVE_ORG" as const;
}

export interface AuthContext {
  user: NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>;
  org: CurrentOrg["org"];
  role: OrgRole;
}

/**
 * Single guard for every protected API route and Server Action.
 *
 *   await requireRole(["org_admin", "warehouse"])
 *
 * Resolves the user, the active org (via cookie + membership check),
 * and confirms the user's role is in `allowed`. Throws — let the
 * route's error handler turn the throw into 401 / 403.
 *
 * Pass `[]` (default) to accept any role, equivalent to "any
 * authenticated member of an org".
 */
export async function requireRole(
  allowed: OrgRole[] = [],
): Promise<AuthContext> {
  const user = await getCurrentUser();
  if (!user) throw new UnauthorizedError("Not signed in");

  const current = await getCurrentOrg();
  if (!current) throw new NoActiveOrgError("No active organization");

  if (allowed.length > 0 && !allowed.includes(current.role)) {
    throw new ForbiddenError(
      `Role ${current.role} not in [${allowed.join(", ")}]`,
    );
  }

  return { user, org: current.org, role: current.role };
}

/**
 * Map our typed errors to consistent HTTP responses. Wrap a route
 * body in try/catch and pipe the error through this. Anything else
 * re-throws so Next.js surfaces a 500 / route-error.
 *
 *   try { ... } catch (e) { return rbacErrorToResponse(e); }
 */
export function rbacErrorToResponse(error: unknown): Response | null {
  if (error instanceof UnauthorizedError) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  if (error instanceof NoActiveOrgError) {
    return Response.json({ error: "no_active_org" }, { status: 409 });
  }
  if (error instanceof ForbiddenError) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }
  return null;
}
