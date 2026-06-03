import { NextResponse } from "next/server"
import { createClient } from "@/lib/db/server"
import { isAdminEmail } from "@/lib/auth/admin"

export const runtime = "nodejs"

type Params = { params: Promise<{ form_code: string }> }

/** Lock is considered stale (and reclaimable) after this many ms
 * without a heartbeat. Client refreshes every 30s, so 2 min gives a
 * tab crash / network drop ~4 heartbeats of slack. */
export const STALE_LOCK_MS = 2 * 60 * 1000

// POST /api/forms/templates/[form_code]/lock
// Acquire or refresh the editing lock. Body: { takeover?: boolean }
// — passing takeover steals a still-fresh lock from someone else
// (useful when an admin's tab crashed and they're back from another
// device).
//
// Returns { ok: true, holder: {...} } when the caller now holds it,
// or 409 + { holder } when somebody else has a fresh lock and you
// didn't pass takeover.
export async function POST(request: Request, { params }: Params) {
  const { form_code } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  if (!isAdminEmail(user.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  let takeover = false
  try {
    const body = (await request.json().catch(() => ({}))) as {
      takeover?: boolean
    }
    takeover = !!body.takeover
  } catch {
    // No body — treat as normal acquire/refresh.
  }

  const { data: row } = await supabase
    .from("form_templates")
    .select("editing_by, editing_by_email, editing_at")
    .eq("form_code", form_code)
    .maybeSingle()
  if (!row) {
    return NextResponse.json({ error: "Template not found" }, { status: 404 })
  }

  const now = Date.now()
  const heldAt = row.editing_at ? Date.parse(row.editing_at) : 0
  const isFresh = heldAt > 0 && now - heldAt < STALE_LOCK_MS
  const heldByMe = row.editing_by === user.id

  if (isFresh && !heldByMe && !takeover) {
    return NextResponse.json(
      {
        error: "Locked",
        holder: {
          email: row.editing_by_email,
          since: row.editing_at,
        },
      },
      { status: 409 },
    )
  }

  const nowIso = new Date(now).toISOString()
  const { error: updateError } = await supabase
    .from("form_templates")
    .update({
      editing_by: user.id,
      editing_by_email: user.email,
      editing_at: nowIso,
    })
    .eq("form_code", form_code)
  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    holder: { email: user.email, since: nowIso, is_me: true },
    took_over: isFresh && !heldByMe && takeover,
  })
}

// DELETE /api/forms/templates/[form_code]/lock
// Release my lock. No-op (200) if I'm not the holder — we don't
// punish a stale release call from a closing tab.
export async function DELETE(_request: Request, { params }: Params) {
  const { form_code } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  if (!isAdminEmail(user.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  // Only clear the columns when the lock is actually mine (avoids
  // racing a takeover that just happened on another tab).
  const { error } = await supabase
    .from("form_templates")
    .update({
      editing_by: null,
      editing_by_email: null,
      editing_at: null,
    })
    .eq("form_code", form_code)
    .eq("editing_by", user.id)
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
