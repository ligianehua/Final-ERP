import "server-only";
import { cache } from "react";
import { createClient } from "./supabase-server";

/**
 * The authenticated Supabase user for the current request, memoized
 * so multiple Server Components can read it without re-hitting auth.
 *
 * Returns null for logged-out requests — callers decide whether to
 * redirect, 401, or render an anonymous variant.
 */
export const getCurrentUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});

/**
 * Same as getCurrentUser but throws if missing — use in API routes
 * and Server Actions that are already gated to authenticated users.
 */
export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) throw new UnauthorizedError("Not signed in");
  return user;
}

export class UnauthorizedError extends Error {
  readonly code = "UNAUTHORIZED" as const;
}
