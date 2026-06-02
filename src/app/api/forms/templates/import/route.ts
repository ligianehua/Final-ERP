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

const fieldEntry = z.object({
  id: z.string().regex(/^[a-z][a-z0-9_]*$/),
  label: z.string().min(1).max(200),
  semantic_type: z.string(),
  data_source: z.string().nullable(),
  required: z.boolean(),
  period_specific: z.boolean().optional(),
})

const importPayload = z.object({
  version: z.number().int().min(1).max(1),
  form_code: z.string().regex(/^[A-Z0-9_]+$/).min(2).max(60),
  form_name: z.string().min(1).max(200),
  agency: z.string().min(1).max(100),
  frequency: z
    .enum(["monthly", "annual", "per_payment", "quarterly"])
    .nullable()
    .optional(),
  description: z.string().max(2000).nullable().optional(),
  source_url: z.string().url().nullable().optional(),
  is_active: z.boolean().optional(),
  dimensions: z.object({
    width: z.number().positive(),
    height: z.number().positive(),
    pageCount: z.number().int().min(1).max(50),
  }),
  field_schema: z.object({
    form_code: z.string(),
    form_name: z.string(),
    agency: z.string(),
    fields: z.array(fieldEntry),
  }),
  field_mapping: z.record(z.string(), coordSpec),
  pdf_base64: z.string().nullable().optional(),
})

// POST /api/forms/templates/import
// Admin-only. Takes a JSON export (from GET .../export) and recreates
// the template. If pdf_base64 is present we also re-render PNGs;
// otherwise we just write the metadata + schema + mapping and the
// receiving admin uses Replace PDF to supply the binary.
//
// Refuses to overwrite an existing form_code — the caller should
// delete or rename first. (We don't silently merge schemas.)
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
  const parsed = importPayload.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 422 },
    )
  }
  const data = parsed.data

  // Refuse to clobber.
  const { data: existing } = await supabase
    .from("form_templates")
    .select("form_code")
    .eq("form_code", data.form_code)
    .maybeSingle()
  if (existing) {
    return NextResponse.json(
      {
        error: `Template "${data.form_code}" already exists. Delete it first or rename the export's form_code.`,
      },
      { status: 409 },
    )
  }

  let pdfStoragePath: string | null = null
  let pagesUploaded = 0

  if (data.pdf_base64) {
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

    pdfStoragePath = `${data.form_code}.pdf`
    {
      const { error } = await supabase.storage
        .from("templates")
        .upload(pdfStoragePath, pdfBytes, {
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

    const workDir = await mkdtemp(join(tmpdir(), "quill-import-"))
    try {
      const stagedPdf = join(workDir, "input.pdf")
      await writeFile(stagedPdf, pdfBytes)
      const pngPrefix = join(workDir, data.form_code)
      await execFileAsync(
        "pdftoppm",
        ["-r", "150", "-png", stagedPdf, pngPrefix],
        { timeout: 120_000 },
      )
      const produced = (await readdir(workDir)).filter(
        (f) => f.startsWith(`${data.form_code}-`) && f.endsWith(".png"),
      )
      produced.sort()
      for (const name of produced) {
        const key = `${data.form_code}/${name}`
        const bytes = await readFile(join(workDir, name))
        const { error } = await supabase.storage
          .from("templates")
          .upload(key, bytes, {
            contentType: "image/png",
            upsert: true,
          })
        if (error) {
          return NextResponse.json(
            { error: `PNG upload failed (${name}): ${error.message}` },
            { status: 500 },
          )
        }
        pagesUploaded++
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "PNG render failed"
      return NextResponse.json({ error: message }, { status: 500 })
    } finally {
      await rm(workDir, { recursive: true, force: true }).catch(() => {})
    }
  }

  const { error: insertError, data: row } = await supabase
    .from("form_templates")
    .insert({
      form_code: data.form_code,
      form_name: data.form_name,
      agency: data.agency,
      frequency: data.frequency ?? null,
      description: data.description ?? null,
      source_url: data.source_url ?? null,
      is_active: data.is_active ?? true,
      pdf_storage_path: pdfStoragePath,
      png_storage_prefix: pdfStoragePath ? data.form_code : null,
      dimensions: data.dimensions,
      field_mapping: data.field_mapping,
      field_schema: data.field_schema,
      created_by: user.id,
    })
    .select()
    .single()

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 })
  }

  return NextResponse.json({
    success: true,
    form_code: data.form_code,
    pdf_uploaded: !!pdfStoragePath,
    pages_uploaded: pagesUploaded,
    row,
  })
}
