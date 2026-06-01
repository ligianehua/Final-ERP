import { NextResponse } from "next/server"
import { z } from "zod"
import { createClient } from "@/lib/db/server"
import { isAdminEmail } from "@/lib/auth/admin"
import {
  getEffectiveTemplate,
  serializeTemplate,
} from "@/lib/forms/templates/effective"
import { getTemplateConfig } from "@/lib/forms/templates"

type Params = { params: Promise<{ form_code: string }> }

const coordSpec = z.object({
  page: z.number().int().min(1),
  x: z.number().finite(),
  y: z.number().finite(),
  width: z.number().finite().optional(),
  height: z.number().finite().optional(),
  size: z.number().finite().optional(),
  align: z.enum(["left", "right", "center"]).optional(),
  maxWidth: z.number().finite().optional(),
})

const patchSchema = z.object({
  field_mapping: z.record(z.string(), coordSpec),
})

// GET /api/forms/templates/[form_code]
// Returns the effective template config (DB-overridden if present, else
// code default) plus a flag telling the client if the current user can
// "Save as template default".
export async function GET(_request: Request, { params }: Params) {
  const { form_code } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const template = await getEffectiveTemplate(form_code)
  if (!template) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  return NextResponse.json({
    template: serializeTemplate(template),
    is_admin: isAdminEmail(user.email),
  })
}

// PATCH /api/forms/templates/[form_code]
// Admin-only: replaces the template's field_mapping. The caller is
// expected to pass the merged (base + overrides) coordinate map.
export async function PATCH(request: Request, { params }: Params) {
  const { form_code } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  if (!isAdminEmail(user.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  // Form must exist in the code-side registry (we don't allow saving
  // layouts for forms Quill doesn't know how to fill).
  if (!getTemplateConfig(form_code)) {
    return NextResponse.json({ error: "Unknown form_code" }, { status: 404 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 422 },
    )
  }

  const { error } = await supabase
    .from("form_templates")
    .update({ field_mapping: parsed.data.field_mapping })
    .eq("form_code", form_code)
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ success: true })
}
