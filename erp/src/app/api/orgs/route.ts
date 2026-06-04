import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";

import { db } from "@/lib/db";
import { orgMembers, organizations } from "@/lib/db/schema";
import { getCurrentUser } from "@/lib/auth/session";
import { listMyOrgs, ACTIVE_ORG_COOKIE } from "@/lib/orgs/current";
import {
  orgCreateSchema,
  slugify,
} from "@/lib/validations/org";

const ACTIVE_COOKIE_OPTS = {
  path: "/",
  sameSite: "lax" as const,
  httpOnly: false, // readable by the org switcher in the topbar later
  maxAge: 60 * 60 * 24 * 365, // 1 year
};

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json({ orgs: await listMyOrgs() });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = orgCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation_failed", issues: z.treeifyError(parsed.error) },
      { status: 400 },
    );
  }

  const input = parsed.data;
  const slug = input.slug ?? slugify(input.name);
  if (slug.length < 3) {
    return NextResponse.json(
      { error: "slug_too_short", hint: "组织名至少要能生成 3 个字符的 slug" },
      { status: 400 },
    );
  }

  // Single transaction: insert org, then insert membership as org_admin.
  // Either both happen or neither — no half-bootstrapped state.
  let created;
  try {
    created = await db.transaction(async (tx) => {
      const [org] = await tx
        .insert(organizations)
        .values({
          name: input.name,
          slug,
          baseCurrency: input.baseCurrency,
          timezone: input.timezone,
        })
        .returning();

      await tx.insert(orgMembers).values({
        orgId: org.id,
        userId: user.id,
        role: "org_admin",
      });

      return org;
    });
  } catch (err) {
    // Drizzle/postgres-js surfaces unique-violation as code 23505.
    const code = (err as { code?: string })?.code;
    if (code === "23505") {
      return NextResponse.json(
        { error: "slug_taken", hint: `slug "${slug}" 已被占用` },
        { status: 409 },
      );
    }
    throw err;
  }

  // First org created → set it active immediately so the next page
  // load sees it without an extra round-trip.
  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_ORG_COOKIE, created.id, ACTIVE_COOKIE_OPTS);

  return NextResponse.json({ org: created }, { status: 201 });
}
