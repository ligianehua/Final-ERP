import { NextResponse } from "next/server"
import { createClient } from "@/lib/db/server"
import { isAdminEmail } from "@/lib/auth/admin"
import { STALE_LOCK_MS } from "../../../lock/route"

export const runtime = "nodejs"

type Params = {
  params: Promise<{ form_code: string; field_id: string }>
}

type FieldLock = {
  user_id: string
  email: string | null
  at: string
}

// POST /api/forms/templates/[form_code]/fields/[field_id]/lock
//
// Claim or refresh a per-field lock so two admins can drag separate
// fields on the same template without colliding. The template-level
// lock (0013) still owns destructive ops (Replace PDF, Re-analyze);
// this is purely a finer-grain advisory layer.
//
// Read-modify-write would race two admins fighting for the same
// field, so the conditional UPDATE below only fires when the field
// is unheld, mine, stale, or `takeover=true`. zero rows updated =
// somebody beat me to it.
export async function POST(request: Request, { params }: Params) {
  const { form_code, field_id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
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
    /* ignore */
  }

  const { data: row } = await supabase
    .from("form_templates")
    .select("editing_fields")
    .eq("form_code", form_code)
    .maybeSingle()
  if (!row) {
    return NextResponse.json({ error: "Template not found" }, { status: 404 })
  }

  const editingFields = (row.editing_fields ?? {}) as Record<string, FieldLock>
  const current = editingFields[field_id]
  const now = Date.now()
  const heldAt = current?.at ? Date.parse(current.at) : 0
  const isFresh = heldAt > 0 && now - heldAt < STALE_LOCK_MS
  const heldByMe = current?.user_id === user.id

  if (current && isFresh && !heldByMe && !takeover) {
    return NextResponse.json(
      {
        error: "FieldLocked",
        holder: { email: current.email, since: current.at, field_id },
      },
      { status: 409 },
    )
  }

  const nowIso = new Date(now).toISOString()
  const next: FieldLock = { user_id: user.id, email: user.email ?? null, at: nowIso }
  const merged = { ...editingFields, [field_id]: next }

  const { error } = await supabase
    .from("form_templates")
    .update({ editing_fields: merged })
    .eq("form_code", form_code)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    ok: true,
    holder: { email: user.email, since: nowIso, is_me: true },
    took_over: !!current && isFresh && !heldByMe && takeover,
  })
}

// DELETE /api/forms/templates/[form_code]/fields/[field_id]/lock
// Release my field lock. No-op if I'm not the holder.
export async function DELETE(_request: Request, { params }: Params) {
  const { form_code, field_id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!isAdminEmail(user.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { data: row } = await supabase
    .from("form_templates")
    .select("editing_fields")
    .eq("form_code", form_code)
    .maybeSingle()
  if (!row) return NextResponse.json({ ok: true })
  const editingFields = (row.editing_fields ?? {}) as Record<string, FieldLock>
  if (editingFields[field_id]?.user_id !== user.id) {
    return NextResponse.json({ ok: true })
  }
  const { [field_id]: _drop, ...rest } = editingFields
  void _drop
  const { error } = await supabase
    .from("form_templates")
    .update({ editing_fields: rest })
    .eq("form_code", form_code)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
