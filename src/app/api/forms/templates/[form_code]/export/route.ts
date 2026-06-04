import { NextResponse } from "next/server"
import { createClient } from "@/lib/db/server"
import { isAdminEmail } from "@/lib/auth/admin"

export const runtime = "nodejs"
export const maxDuration = 60

type Params = { params: Promise<{ form_code: string }> }

/**
 * Versioned envelope. Bump `version` when the schema changes shape;
 * the importer keys off it for back-compat handling.
 */
export const TEMPLATE_EXPORT_VERSION = 1

// GET /api/forms/templates/[form_code]/export
// Admin-only. Returns a self-contained JSON dump that the importer can
// recreate the template from — including the original PDF as base64
// so the receiver doesn't need a side-channel for the binary.
export async function GET(_request: Request, { params }: Params) {
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
    .select(
      "form_code, form_name, agency, frequency, description, source_url, is_active, dimensions, field_schema, field_mapping, pdf_storage_path",
    )
    .eq("form_code", form_code)
    .maybeSingle()
  if (!row) {
    return NextResponse.json({ error: "Template not found" }, { status: 404 })
  }

  // Embed the PDF bytes if we have them. Code-only templates without a
  // stored PDF still export (the importer would need the receiver to
  // run Replace PDF after import).
  let pdf_base64: string | null = null
  if (row.pdf_storage_path) {
    try {
      const { data: blob, error } = await supabase.storage
        .from("templates")
        .download(row.pdf_storage_path)
      if (!error && blob) {
        const bytes = new Uint8Array(await blob.arrayBuffer())
        pdf_base64 = Buffer.from(bytes).toString("base64")
      }
    } catch {
      // Fall through — export remains valid without the PDF.
    }
  }

  const payload = {
    version: TEMPLATE_EXPORT_VERSION,
    exported_at: new Date().toISOString(),
    exported_by: user.email ?? null,
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
  }

  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${form_code}.template.json"`,
      "Cache-Control": "no-store",
    },
  })
}
