import { execFile } from "node:child_process"
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { promisify } from "node:util"
import { NextResponse } from "next/server"
import { PDFDocument } from "pdf-lib"
import { createClient } from "@/lib/db/server"
import { isAdminEmail } from "@/lib/auth/admin"
import { convertToPdf } from "@/lib/convert/to-pdf"
import {
  getExtension,
  isSupportedExtension,
} from "@/lib/convert/supported"

export const runtime = "nodejs"
export const maxDuration = 180

const MAX_FILE_SIZE_MB = 25
const MAX_FILE_SIZE = MAX_FILE_SIZE_MB * 1024 * 1024

const execFileAsync = promisify(execFile)

type Params = { params: Promise<{ form_code: string }> }

type CoordSpec = {
  page: number
  x: number
  y: number
  width?: number
  height?: number
  size?: number
  align?: "left" | "right" | "center"
  maxWidth?: number
}

// POST /api/forms/templates/[form_code]/replace-pdf
// Admin-only. Swap the source PDF without re-running AI analysis or
// touching the field schema. Re-rasterises every page, replaces the
// existing PNGs in Storage, and prunes any field_mapping entries that
// pointed to pages the new PDF no longer has.
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

  // Row must already exist — Replace is a per-template action.
  const { data: existing } = await supabase
    .from("form_templates")
    .select(
      "form_code, pdf_storage_path, png_storage_prefix, field_mapping",
    )
    .eq("form_code", form_code)
    .maybeSingle()
  if (!existing) {
    return NextResponse.json(
      { error: "Template not found in DB. Use Add a template to first import it." },
      { status: 404 },
    )
  }

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json(
      { error: "Expected multipart/form-data" },
      { status: 400 },
    )
  }
  const file = formData.get("file")
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "Missing 'file'" }, { status: 400 })
  }
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { error: `File too large (max ${MAX_FILE_SIZE_MB} MB)` },
      { status: 413 },
    )
  }
  const ext = getExtension(file.name)
  if (!isSupportedExtension(ext)) {
    return NextResponse.json(
      { error: `Unsupported file type: .${ext}` },
      { status: 415 },
    )
  }

  // 1) Canonical PDF.
  const inputBytes = new Uint8Array(await file.arrayBuffer())
  let pdfBytes: Buffer
  try {
    const pdf =
      ext === "pdf" ? inputBytes : await convertToPdf(inputBytes, file.name)
    pdfBytes = Buffer.from(pdf)
  } catch (err) {
    const message = err instanceof Error ? err.message : "Conversion failed"
    return NextResponse.json({ error: message }, { status: 500 })
  }

  // 2) Dimensions.
  let dimensions: { width: number; height: number; pageCount: number }
  try {
    const pdf = await PDFDocument.load(pdfBytes)
    const pages = pdf.getPages()
    const first = pages[0]
    dimensions = {
      width: first.getWidth(),
      height: first.getHeight(),
      pageCount: pages.length,
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "PDF parse failed"
    return NextResponse.json({ error: message }, { status: 500 })
  }

  // 3) Wipe existing PNGs (if any) so a shorter new PDF doesn't leave
  //    orphan high-numbered pages behind. PDF itself just gets upserted
  //    on top of the same key.
  const pngPrefix = existing.png_storage_prefix ?? form_code
  const pdfKey = existing.pdf_storage_path ?? `${form_code}.pdf`
  try {
    const { data: existingPngs } = await supabase.storage
      .from("templates")
      .list(pngPrefix)
    if (existingPngs && existingPngs.length > 0) {
      const keys = existingPngs.map((f) => `${pngPrefix}/${f.name}`)
      await supabase.storage.from("templates").remove(keys)
    }
  } catch {
    // Best-effort. If the bucket was already clean, that's fine.
  }

  // 4) Re-upload the PDF.
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

  // 5) Re-rasterise every page.
  let pagesUploaded = 0
  const workDir = await mkdtemp(join(tmpdir(), "quill-replace-"))
  try {
    const stagedPdf = join(workDir, "input.pdf")
    await writeFile(stagedPdf, pdfBytes)
    const pngPath = join(workDir, form_code)
    await execFileAsync(
      "pdftoppm",
      ["-r", "150", "-png", stagedPdf, pngPath],
      { timeout: 120_000 },
    )
    const produced = (await readdir(workDir)).filter(
      (f) => f.startsWith(`${form_code}-`) && f.endsWith(".png"),
    )
    produced.sort()
    for (const name of produced) {
      const key = `${pngPrefix}/${name}`
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

  // 6) Prune field_mapping entries that point past the new page count.
  //    Keeps the schema intact — the orphan fields just lose their
  //    coordinates and will be re-placed if/when the admin saves a
  //    schema edit (the PATCH route's reconciliation handles defaults).
  const oldMapping = (existing.field_mapping ?? {}) as Record<string, CoordSpec>
  const pruned: Record<string, CoordSpec> = {}
  const orphans: string[] = []
  for (const [id, spec] of Object.entries(oldMapping)) {
    if (spec.page <= dimensions.pageCount) {
      pruned[id] = spec
    } else {
      orphans.push(id)
    }
  }

  // 7) Persist new dimensions, paths, mapping.
  const { error: updateError } = await supabase
    .from("form_templates")
    .update({
      pdf_storage_path: pdfKey,
      png_storage_prefix: pngPrefix,
      dimensions,
      field_mapping: pruned,
    })
    .eq("form_code", form_code)
  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  return NextResponse.json({
    success: true,
    form_code,
    pages_uploaded: pagesUploaded,
    dimensions,
    orphan_field_ids: orphans,
  })
}
