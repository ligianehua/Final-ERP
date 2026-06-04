import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth/session";
import { isMember, ACTIVE_ORG_COOKIE } from "@/lib/orgs/current";

const bodySchema = z.object({ orgId: z.uuid() });

/**
 * Switch the active organization for the signed-in user.
 *
 * Body: { orgId: "<uuid>" }
 *
 * Guard: the caller must already be a member of `orgId` — otherwise
 * we'd be handing out access by cookie tampering. The cookie itself is
 * just a UX preference; every protected query re-checks membership.
 */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_org_id" }, { status: 400 });
  }

  const role = await isMember(user.id, parsed.data.orgId);
  if (!role) {
    return NextResponse.json({ error: "not_a_member" }, { status: 403 });
  }

  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_ORG_COOKIE, parsed.data.orgId, {
    path: "/",
    sameSite: "lax",
    httpOnly: false,
    maxAge: 60 * 60 * 24 * 365,
  });

  return NextResponse.json({ ok: true, role });
}
