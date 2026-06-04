import { NextResponse } from "next/server"
import { z } from "zod"
import { createClient } from "@/lib/db/server"
import { isAdminEmail } from "@/lib/auth/admin"
import {
  getEffectiveTemplate,
  serializeTemplate,
} from "@/lib/forms/templates/effective"
import { getTemplateConfig } from "@/lib/forms/templates"
import { isFieldLockedByOther } from "./lock/route"
import { logAudit } from "@/lib/audit/log"

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

const fieldSchemaEntry = z.object({
  id: z.string().regex(/^[a-z][a-z0-9_]*$/).min(1).max(60),
  label: z.string().min(1).max(200),
  semantic_type: z.string().min(1).max(60),
  data_source: z.string().nullable(),
  required: z.boolean(),
  period_specific: z.boolean().optional(),
})

const fieldSchemaPayload = z.object({
  form_code: z.string().optional(),
  form_name: z.string().optional(),
  agency: z.string().optional(),
  fields: z.array(fieldSchemaEntry),
})

const patchSchema = z
  .object({
    /** Replace the coord map (the "Save as template default" path). */
    field_mapping: z.record(z.string(), coordSpec).optional(),
    /** Replace the field schema. Server reconciles field_mapping for us. */
    field_schema: fieldSchemaPayload.optional(),
    /** Plain-old metadata edits from the admin detail page. */
    form_name: z.string().min(1).max(200).optional(),
    agency: z.string().min(1).max(100).optional(),
    frequency: z
      .enum(["monthly", "annual", "per_payment", "quarterly"])
      .nullable()
      .optional(),
    description: z.string().max(2000).nullable().optional(),
    is_active: z.boolean().optional(),
    source_url: z.string().url().nullable().optional(),
  })
  .refine((d) => Object.keys(d).length > 0, {
    message: "Nothing to update",
  })

// GET /api/forms/templates/[form_code]
// Returns the effective template config (DB-overridden if present, else
// code default) plus a flag telling the client if the current user can
// "Save as template default".
export async function GET(_request: Request, { params }: Params) {
  const { form_code } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const template = await getEffectiveTemplate(form_code)
  if (!template) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  return NextResponse.json({
    template: serializeTemplate(form_code, template),
    is_admin: isAdminEmail(user.email),
  })
}

// PATCH /api/forms/templates/[form_code]
// Admin-only. Three flavours of edit, freely mixable:
//   - field_mapping: rebake the coord map ("Save as template default").
//   - metadata: form_name / agency / frequency / description / is_active
//                / source_url (whatever the admin detail page lets edit).
//
// Either path is allowed for code-side templates (BIR_2550M etc.) — the
// row may not exist yet, so we UPSERT instead of UPDATE so the first
// edit auto-creates the DB shadow.
export async function PATCH(request: Request, { params }: Params) {
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

  // form_code must be known to the catalog one way or another (code OR
  // a DB-only template).
  const { data: existing } = await supabase
    .from("form_templates")
    .select(
      "form_code, form_name, agency, frequency, description, is_active, source_url, dimensions, field_mapping, field_schema, editing_fields",
    )
    .eq("form_code", form_code)
    .maybeSingle()
  if (!existing && !getTemplateConfig(form_code)) {
    return NextResponse.json({ error: "Unknown form_code" }, { status: 404 })
  }

  // Field-level lock enforcement. The coexistence model lets multiple
  // admins edit the same template at once — provided they're not
  // touching the same field. Any field whose mapping or schema entry
  // would change here must be unheld or held by me.
  const editingFields = existing?.editing_fields ?? {}
  const conflictingFields: string[] = []
  const oldMapping = (existing?.field_mapping ?? {}) as Record<string, unknown>
  if (parsed.data.field_mapping) {
    for (const [fid, next] of Object.entries(parsed.data.field_mapping)) {
      const prev = oldMapping[fid]
      const changed = JSON.stringify(prev) !== JSON.stringify(next)
      if (!changed) continue
      const other = isFieldLockedByOther(editingFields, fid, user.id)
      if (other) conflictingFields.push(fid)
    }
  }
  if (parsed.data.field_schema) {
    const oldSchemaFields =
      (existing?.field_schema as { fields?: Array<{ id: string }> } | null)
        ?.fields ?? []
    const oldById = new Map(oldSchemaFields.map((f) => [f.id, f]))
    for (const f of parsed.data.field_schema.fields) {
      const prev = oldById.get(f.id)
      const changed = !prev || JSON.stringify(prev) !== JSON.stringify(f)
      if (!changed) continue
      const other = isFieldLockedByOther(editingFields, f.id, user.id)
      if (other) conflictingFields.push(f.id)
    }
    // Detect schema-row deletions — also need their locks free.
    const newIds = new Set(parsed.data.field_schema.fields.map((f) => f.id))
    for (const old of oldSchemaFields) {
      if (newIds.has(old.id)) continue
      const other = isFieldLockedByOther(editingFields, old.id, user.id)
      if (other) conflictingFields.push(old.id)
    }
  }
  if (conflictingFields.length > 0) {
    return NextResponse.json(
      {
        error: "FieldLocked",
        fields: conflictingFields,
      },
      { status: 423 },
    )
  }

  // If field_schema is being edited, reconcile field_mapping so every
  // field has a CoordSpec. New fields get a sensible default position
  // (stacked vertically near the top of page 1) — admin can drag to
  // the right spot in layout mode afterwards. Dropped fields lose
  // their mapping entry to avoid orphan boxes.
  let reconciledMapping: Record<string, unknown> | undefined
  if (parsed.data.field_schema) {
    const dims = (existing?.dimensions ?? {
      width: 612,
      height: 792,
    }) as { width: number; height: number }
    const oldMap = (existing?.field_mapping ?? {}) as Record<string, unknown>
    const newMap: Record<string, unknown> = {}
    parsed.data.field_schema.fields.forEach((f, idx) => {
      newMap[f.id] = oldMap[f.id] ?? {
        page: 1,
        x: 50,
        y: Math.max(50, dims.height - 100 - idx * 22),
        width: 200,
        height: 14,
        size: 10,
      }
    })
    reconciledMapping = newMap
  }

  // UPSERT — first admin edit of a code-shipped template inserts the
  // shadow row; subsequent edits update it. Code-side metadata fills
  // any required NOT NULL columns when we insert fresh.
  const codeBase = getTemplateConfig(form_code)
  const payload: Record<string, unknown> = {
    form_code,
    form_name: parsed.data.form_name ?? existing?.form_name ?? form_code,
    agency:
      parsed.data.agency ?? existing?.agency ?? (codeBase ? "" : ""),
    ...parsed.data,
  }
  if (reconciledMapping) {
    payload.field_mapping = parsed.data.field_mapping ?? reconciledMapping
  }

  const { error } = await supabase
    .from("form_templates")
    .upsert(payload, { onConflict: "form_code" })
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Audit: separate entries per concern so the viewer can filter.
  const actor = { id: user.id, email: user.email ?? null }
  const target = { kind: "form_template" as const, id: form_code }
  if (parsed.data.field_mapping) {
    await logAudit(supabase, {
      actor,
      action: "template.update_field_mapping",
      target,
      before: { field_mapping: existing?.field_mapping ?? null },
      after: { field_mapping: parsed.data.field_mapping },
    })
  }
  if (parsed.data.field_schema) {
    await logAudit(supabase, {
      actor,
      action: "template.update_schema",
      target,
      before: { field_schema: existing?.field_schema ?? null },
      after: { field_schema: parsed.data.field_schema },
    })
  }
  const metaKeys = [
    "form_name",
    "agency",
    "frequency",
    "description",
    "is_active",
    "source_url",
  ] as const
  const metaBefore: Record<string, unknown> = {}
  const metaAfter: Record<string, unknown> = {}
  for (const k of metaKeys) {
    if (parsed.data[k] !== undefined) {
      metaBefore[k] = (existing as Record<string, unknown> | undefined)?.[k] ?? null
      metaAfter[k] = parsed.data[k]
    }
  }
  if (Object.keys(metaAfter).length > 0) {
    await logAudit(supabase, {
      actor,
      action: "template.update_metadata",
      target,
      before: metaBefore,
      after: metaAfter,
    })
  }

  return NextResponse.json({ success: true })
}

// DELETE /api/forms/templates/[form_code]
// Admin-only. Removes the DB row plus any Storage objects owned by it.
// For code-shipped templates this just reverts to the factory defaults;
// for DB-only templates it actually removes the form from the catalog.
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

  // Get the storage paths so we can clean them up after deleting the row.
  const { data: row } = await supabase
    .from("form_templates")
    .select("pdf_storage_path, png_storage_prefix")
    .eq("form_code", form_code)
    .maybeSingle()

  const { error: deleteError } = await supabase
    .from("form_templates")
    .delete()
    .eq("form_code", form_code)
  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 })
  }

  await logAudit(supabase, {
    actor: { id: user.id, email: user.email ?? null },
    action: "template.delete",
    target: { kind: "form_template", id: form_code },
  })

  // Best-effort cleanup of Storage assets. Leaving orphans is acceptable
  // (a future GC job could sweep) but it's polite to clean up now.
  if (row?.pdf_storage_path) {
    await supabase.storage
      .from("templates")
      .remove([row.pdf_storage_path])
      .catch(() => {})
  }
  if (row?.png_storage_prefix) {
    const { data: list } = await supabase.storage
      .from("templates")
      .list(row.png_storage_prefix)
    if (list && list.length > 0) {
      await supabase.storage
        .from("templates")
        .remove(list.map((f) => `${row.png_storage_prefix}/${f.name}`))
        .catch(() => {})
    }
  }

  return NextResponse.json({ success: true })
}
