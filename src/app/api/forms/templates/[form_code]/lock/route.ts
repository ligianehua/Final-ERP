import { NextResponse } from "next/server"
import { createClient } from "@/lib/db/server"
import { isAdminEmail } from "@/lib/auth/admin"

export const runtime = "nodejs"

type Params = { params: Promise<{ form_code: string }> }

/** A session / field lock is stale (and reclaimable) after this many
 * ms with no heartbeat. Client refreshes every 10s, so 2 min gives a
 * tab crash / network drop ~12 heartbeats of slack. */
export const STALE_LOCK_MS = 2 * 60 * 1000

type FieldLock = { user_id: string; email: string | null; at: string }
type Session = { email: string | null; at: string }

function pruneStale<T extends { at: string }>(
  map: Record<string, T>,
  now: number,
): Record<string, T> {
  const out: Record<string, T> = {}
  for (const [k, v] of Object.entries(map)) {
    if (now - Date.parse(v.at) < STALE_LOCK_MS) out[k] = v
  }
  return out
}

// POST /api/forms/templates/[form_code]/lock
//
// Presence heartbeat — register me as a current editor of this
// template and refresh any field locks I'm holding. Many admins can
// coexist on the same template; field-level locks (see the per-field
// route) prevent two admins from stepping on the same field at once.
//
// Body (all optional):
//   { fields?: string[] }  — refresh my locks on these field ids
//
// Returns:
//   { ok: true, me: { email, at }, sessions: { user_id: Session },
//     editing_fields: { field_id: FieldLock } }
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

  let heldFields: string[] = []
  try {
    const body = (await request.json().catch(() => ({}))) as {
      fields?: string[]
    }
    if (Array.isArray(body.fields)) {
      heldFields = body.fields.filter((s): s is string => typeof s === "string")
    }
  } catch {
    /* ignore */
  }

  const { data: row } = await supabase
    .from("form_templates")
    .select("editing_sessions, editing_fields")
    .eq("form_code", form_code)
    .maybeSingle()
  if (!row) {
    return NextResponse.json({ error: "Template not found" }, { status: 404 })
  }

  const now = Date.now()
  const nowIso = new Date(now).toISOString()

  const sessions = pruneStale(
    (row.editing_sessions ?? {}) as Record<string, Session>,
    now,
  )
  sessions[user.id] = { email: user.email ?? null, at: nowIso }

  const fields = pruneStale(
    (row.editing_fields ?? {}) as Record<string, FieldLock>,
    now,
  )
  // Refresh my held-field timestamps. We do NOT silently claim a
  // field already held by someone else here — the dedicated per-field
  // route owns that decision (and returns 409 when busy).
  for (const fid of heldFields) {
    const cur = fields[fid]
    if (!cur || cur.user_id === user.id) {
      fields[fid] = { user_id: user.id, email: user.email ?? null, at: nowIso }
    }
  }

  const { error } = await supabase
    .from("form_templates")
    .update({ editing_sessions: sessions, editing_fields: fields })
    .eq("form_code", form_code)
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    me: { user_id: user.id, email: user.email, at: nowIso },
    sessions,
    editing_fields: fields,
  })
}

// DELETE /api/forms/templates/[form_code]/lock
// Drop my presence + release my field locks. Idempotent.
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

  const { data: row } = await supabase
    .from("form_templates")
    .select("editing_sessions, editing_fields")
    .eq("form_code", form_code)
    .maybeSingle()
  if (!row) return NextResponse.json({ ok: true })

  const sessions = { ...((row.editing_sessions ?? {}) as Record<string, Session>) }
  delete sessions[user.id]

  const fields = Object.fromEntries(
    Object.entries((row.editing_fields ?? {}) as Record<string, FieldLock>).filter(
      ([, v]) => v.user_id !== user.id,
    ),
  )

  const { error } = await supabase
    .from("form_templates")
    .update({ editing_sessions: sessions, editing_fields: fields })
    .eq("form_code", form_code)
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}

/**
 * Server-side helper: is somebody other than `userId` actively
 * touching `fieldId` on this template? Used by the field-mapping
 * PATCH guard so two admins can't drag the same field at once.
 */
export function isFieldLockedByOther(
  editingFields: unknown,
  fieldId: string,
  userId: string,
  now = Date.now(),
): FieldLock | null {
  const map = (editingFields ?? {}) as Record<string, FieldLock>
  const lock = map[fieldId]
  if (!lock) return null
  if (lock.user_id === userId) return null
  if (now - Date.parse(lock.at) > STALE_LOCK_MS) return null
  return lock
}
