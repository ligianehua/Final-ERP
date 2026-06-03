import { NextResponse } from "next/server"
import { createClient } from "@/lib/db/server"
import { isAdminEmail } from "@/lib/auth/admin"

export const runtime = "nodejs"

// GET /api/admin/audit?target_kind=&target_id=&actor_id=&limit=
// Admin-only listing of the audit_log, newest first. All filters
// optional. Default page size 100, max 500.
export async function GET(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!isAdminEmail(user.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const url = new URL(request.url)
  const targetKind = url.searchParams.get("target_kind")
  const targetId = url.searchParams.get("target_id")
  const actorId = url.searchParams.get("actor_id")
  const limit = Math.min(
    500,
    Math.max(1, parseInt(url.searchParams.get("limit") ?? "100", 10) || 100),
  )

  let q = supabase
    .from("audit_log")
    .select("id, actor_id, actor_email, action, target_kind, target_id, before, after, at")
    .order("at", { ascending: false })
    .limit(limit)
  if (targetKind) q = q.eq("target_kind", targetKind)
  if (targetId) q = q.eq("target_id", targetId)
  if (actorId) q = q.eq("actor_id", actorId)

  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ entries: data ?? [] })
}
