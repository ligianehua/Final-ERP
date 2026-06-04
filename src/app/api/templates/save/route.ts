import { execFile } from "node:child_process"
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { promisify } from "node:util"
import { NextResponse } from "next/server"
import { z } from "zod"
import { createClient } from "@/lib/db/server"
import { isAdminEmail } from "@/lib/auth/admin"

export const runtime = "nodejs"
export const maxDuration = 180

const execFileAsync = promisify(execFile)

const fieldSchema = z.object({
  id: z.string().regex(/^[a-z][a-z0-9_]*$/),
  label: z.string().min(1).max(200),
  semantic_type: z.string(),
  data_source: z.string().nullable(),
  required: z.boolean(),
  page: z.number().int().min(1),
  /** Baseline-x in PDF points. */
  x: z.number().finite(),
  /** Baseline-y in PDF points (pdf-lib bottom-up origin). */
  y: z.number().finite(),
  width: z.number().finite().positive(),
  height: z.number().finite().positive(),
  size: z.number().finite().positive(),
  align: z.enum(["left", "right", "center"]).optional(),
  period_specific: z.boolean().optional(),
})

const saveSchema = z.object({
  form_code: z.string().regex(/^[A-Z0-9_]+$/).min(2).max(60),
  form_name: z.string().min(1).max(200),
  agency: z.string().min(1).max(100),
  frequency: z.enum(["monthly", "annual", "per_payment", "quarterly"]).optional(),
  pdf_base64: z.string().min(1),
  dimensions: z.object({
    width: z.number().positive(),
    height: z.number().positive(),
    pageCount: z.number().int().min(1).max(50),
  }),
  fields: z.array(fieldSchema),
})

// POST /api/templates/save
// Admin-only. Persists an analyzed template:
//   1) uploads the PDF to Storage at `templates/<form_code>.pdf`
//   2) renders each page to PNG (pdftoppm) and uploads them as
//      `templates/<form_code>-<n>.png` for the WYSIWYG editor
//   3) UPSERTs form_templates with field_mapping (CoordSpec map),
//      field_schema (FormSchema-shaped), dimensions, and the storage
//      paths so getEffectiveTemplate can serve it without code.
//
// Re-saving the same form_code replaces the bytes and refreshes the
// row — gives admins an "edit and re-bake" path without a separate
// flow.
export async function POST(request: Request) {
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
  const parsed = saveSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 422 },
    )
  }
  const data = parsed.data

  // 1) Decode the PDF bytes.
  let pdfBytes: Buffer
  try {
    pdfBytes = Buffer.from(data.pdf_base64, "base64")
  } catch {
    return NextResponse.json(
      { error: "pdf_base64 is not valid base64" },
      { status: 400 },
    )
  }
  if (pdfBytes.length < 100) {
    return NextResponse.json(
      { error: "PDF bytes too small to be real" },
      { status: 400 },
    )
  }

  // 2) Upload the PDF to Storage.
  const pdfKey = `${data.form_code}.pdf`
  {
    const { error } = await supabase.storage
      .from("templates")
      .upload(pdfKey, pdfBytes, {
        contentType: "application/pdf",
        upsert: true,
      })
    if (error) {
      return NextResponse.json(
        { error: `PDF upload failed: ${error.message}` },
        { status: 500 },
      )
    }
  }

  // 3) Render page PNGs (pdftoppm) and upload each.
  let pngKeys: string[] = []
  const workDir = await mkdtemp(join(tmpdir(), "quill-tpl-"))
  try {
    const stagedPdf = join(workDir, "input.pdf")
    await writeFile(stagedPdf, pdfBytes)
    const pngPrefix = join(workDir, data.form_code)
    await execFileAsync(
      "pdftoppm",
      ["-r", "150", "-png", stagedPdf, pngPrefix],
      { timeout: 90_000 },
    )
    const produced = (await readdir(workDir)).filter(
      (f) => f.startsWith(`${data.form_code}-`) && f.endsWith(".png"),
    )
    produced.sort()
    for (const file of produced) {
      const key = `${data.form_code}/${file}`
      const bytes = await readFile(join(workDir, file))
      const { error } = await supabase.storage
        .from("templates")
        .upload(key, bytes, {
          contentType: "image/png",
          upsert: true,
        })
      if (error) {
        return NextResponse.json(
          { error: `PNG upload failed (${file}): ${error.message}` },
          { status: 500 },
        )
      }
      pngKeys.push(key)
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "PNG render failed"
    return NextResponse.json({ error: message }, { status: 500 })
  } finally {
    await rm(workDir, { recursive: true, force: true }).catch(() => {})
  }

  // 4) Build field_mapping (CoordSpec record) and field_schema.
  const fieldMapping: Record<
    string,
    {
      page: number
      x: number
      y: number
      width: number
      height: number
      size: number
      align?: "left" | "right" | "center"
    }
  > = {}
  const fieldSchemaList: Array<{
    id: string
    label: string
    semantic_type: string
    data_source: string | null
    required: boolean
    period_specific: boolean
  }> = []
  for (const f of data.fields) {
    fieldMapping[f.id] = {
      page: f.page,
      x: f.x,
      y: f.y,
      width: f.width,
      height: f.height,
      size: f.size,
      align: f.align,
    }
    fieldSchemaList.push({
      id: f.id,
      label: f.label,
      semantic_type: f.semantic_type,
      data_source: f.data_source,
      required: f.required,
      period_specific:
        f.period_specific ??
        (f.semantic_type === "period_month" ||
          f.semantic_type === "period_year"),
    })
  }

  // 5) UPSERT the form_templates row.
  const { error: upsertError, data: row } = await supabase
    .from("form_templates")
    .upsert(
      {
        form_code: data.form_code,
        form_name: data.form_name,
        agency: data.agency,
        frequency: data.frequency ?? null,
        is_active: true,
        pdf_storage_path: pdfKey,
        png_storage_prefix: data.form_code,
        dimensions: data.dimensions,
        field_mapping: fieldMapping,
        field_schema: {
          form_code: data.form_code,
          form_name: data.form_name,
          agency: data.agency,
          fields: fieldSchemaList,
        },
        created_by: user.id,
      },
      { onConflict: "form_code" },
    )
    .select()
    .single()

  if (upsertError) {
    return NextResponse.json({ error: upsertError.message }, { status: 500 })
  }

  return NextResponse.json({
    success: true,
    form_code: data.form_code,
    pages_uploaded: pngKeys.length,
    row,
  })
}
