import { NextResponse } from "next/server"
import { createClient } from "@/lib/db/server"
import { isAdminEmail } from "@/lib/auth/admin"
import { TEMPLATE_EXPORT_VERSION } from "../[form_code]/export/route"

export const runtime = "nodejs"
export const maxDuration = 300

/**
 * Cap to keep the response from becoming an unbounded multi-hundred-MB
 * download if someone passes ?form_codes= empty against a huge catalog.
 */
const MAX_TEMPLATES_PER_EXPORT = 50

// GET /api/forms/templates/bulk-export?codes=A,B,C  (omit codes → all)
// Admin-only. Returns one JSON array containing the same envelope
// shape that the single-template export uses, packed in a "templates"
// field. Importer is taught to recognise both shapes.
export async function GET(request: Request) {
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

  const url = new URL(request.url)
  const codesRaw = url.searchParams.get("codes")
  const requestedCodes = codesRaw
    ? codesRaw
        .split(",")
        .map((c) => c.trim())
        .filter(Boolean)
    : null

  const query = supabase
    .from("form_templates")
    .select(
      "form_code, form_name, agency, frequency, description, source_url, is_active, dimensions, field_schema, field_mapping, pdf_storage_path",
    )
    .order("form_code")
    .limit(MAX_TEMPLATES_PER_EXPORT)
  const { data: rows, error } = requestedCodes
    ? await query.in("form_code", requestedCodes)
    : await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  if (!rows || rows.length === 0) {
    return NextResponse.json(
      { error: "No templates matched" },
      { status: 404 },
    )
  }

  // Embed each PDF if we have it. Failures are non-fatal — a template
  // exports without its binary and the importer warns about it.
  const templates: Array<Record<string, unknown>> = []
  for (const row of rows) {
    let pdf_base64: string | null = null
    if (row.pdf_storage_path) {
      try {
        const { data: blob, error: dlError } = await supabase.storage
          .from("templates")
          .download(row.pdf_storage_path)
        if (!dlError && blob) {
          const bytes = new Uint8Array(await blob.arrayBuffer())
          pdf_base64 = Buffer.from(bytes).toString("base64")
        }
      } catch {
        // Fall through.
      }
    }
    templates.push({
      version: TEMPLATE_EXPORT_VERSION,
      form_code: row.form_code,
      form_name: row.form_name,
      agency: row.agency,
      frequency: row.frequency,
      description: row.description,
      source_url: row.source_url,
      is_active: row.is_active,
      dimensions: row.dimensions,
      field_schema: row.field_schema,
      field_mapping: row.field_mapping,
      pdf_base64,
    })
  }

  const payload = {
    bundle_version: 1,
    exported_at: new Date().toISOString(),
    exported_by: user.email ?? null,
    template_count: templates.length,
    templates,
  }

  const datestamp = new Date().toISOString().slice(0, 10)
  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="quill-templates-${templates.length}-${datestamp}.json"`,
      "Cache-Control": "no-store",
    },
  })
}
