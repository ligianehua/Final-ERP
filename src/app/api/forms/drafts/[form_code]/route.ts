import { NextResponse } from "next/server"
import { z } from "zod"
import { createClient } from "@/lib/db/server"

export const runtime = "nodejs"

type Params = { params: Promise<{ form_code: string }> }

const ZERO_UUID = "00000000-0000-0000-0000-000000000000"

// Slot tuple matches the localStorage key the fill flow uses:
//   (form_code, company_id, signatory_id)
// Caller passes them as query params on every method.
const slotSchema = z.object({
  company_id: z.string().uuid().optional(),
  signatory_id: z.string().uuid().optional(),
})

function parseSlot(url: URL) {
  const parsed = slotSchema.safeParse({
    company_id: url.searchParams.get("company_id") ?? undefined,
    signatory_id: url.searchParams.get("signatory_id") ?? undefined,
  })
  if (!parsed.success) return null
  return {
    company_id: parsed.data.company_id ?? null,
    signatory_id: parsed.data.signatory_id ?? null,
  }
}

// GET /api/forms/drafts/[form_code]?company_id=...&signatory_id=...
// Returns the cloud draft for this slot or { draft: null }.
export async function GET(request: Request, { params }: Params) {
  const { form_code } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const slot = parseSlot(new URL(request.url))
  if (!slot) return NextResponse.json({ error: "Bad slot" }, { status: 400 })

  const { data, error } = await supabase
    .from("form_drafts")
    .select("values, overrides, period, updated_at")
    .eq("user_id", user.id)
    .eq("form_code", form_code)
    .eq("company_id", slot.company_id ?? ZERO_UUID)
    .eq("signatory_id", slot.signatory_id ?? ZERO_UUID)
    .maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ draft: data ?? null })
}

const putSchema = z.object({
  company_id: z.string().uuid().nullable(),
  signatory_id: z.string().uuid().nullable(),
  values: z.record(z.string(), z.string()),
  overrides: z.record(z.string(), z.unknown()).default({}),
  period: z.string().nullable().optional(),
})

// PUT /api/forms/drafts/[form_code]
// Upsert the draft for this slot. Called from the fill flow's
// debounced autosave hook.
export async function PUT(request: Request, { params }: Params) {
  const { form_code } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }
  const parsed = putSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 422 },
    )
  }

  const row = {
    user_id: user.id,
    form_code,
    company_id: parsed.data.company_id,
    signatory_id: parsed.data.signatory_id,
    values: parsed.data.values,
    overrides: parsed.data.overrides,
    period: parsed.data.period ?? null,
    updated_at: new Date().toISOString(),
  }

  // The unique index uses COALESCE on company_id / signatory_id, so we
  // can't use Supabase's onConflict shorthand. Try update first, then
  // insert if zero rows touched.
  const { data: updated, error: updErr } = await supabase
    .from("form_drafts")
    .update(row)
    .eq("user_id", user.id)
    .eq("form_code", form_code)
    .eq("company_id", row.company_id ?? ZERO_UUID)
    .eq("signatory_id", row.signatory_id ?? ZERO_UUID)
    .select("id")
  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 })
  if (updated && updated.length > 0) {
    return NextResponse.json({ ok: true, updated_at: row.updated_at })
  }

  const { error: insErr } = await supabase.from("form_drafts").insert(row)
  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 })
  return NextResponse.json({ ok: true, updated_at: row.updated_at })
}

// DELETE /api/forms/drafts/[form_code]?company_id=...&signatory_id=...
// Called from the fill flow after a successful submission.
export async function DELETE(request: Request, { params }: Params) {
  const { form_code } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const slot = parseSlot(new URL(request.url))
  if (!slot) return NextResponse.json({ error: "Bad slot" }, { status: 400 })

  const { error } = await supabase
    .from("form_drafts")
    .delete()
    .eq("user_id", user.id)
    .eq("form_code", form_code)
    .eq("company_id", slot.company_id ?? ZERO_UUID)
    .eq("signatory_id", slot.signatory_id ?? ZERO_UUID)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
