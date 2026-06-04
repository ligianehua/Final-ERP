import { NextResponse } from "next/server"
import { PDFDocument } from "pdf-lib"
import { createClient } from "@/lib/db/server"
import { isAdminEmail } from "@/lib/auth/admin"
import { convertToPdf } from "@/lib/convert/to-pdf"
import {
  getExtension,
  isSupportedExtension,
} from "@/lib/convert/supported"
import { fileToImageDataUrls } from "@/lib/ai/file-to-image"
import { analyzeTemplate, type TemplateAnalysis } from "@/lib/ai/analyze-template"

export const runtime = "nodejs"
export const maxDuration = 300

const MAX_FILE_SIZE_MB = 25
const MAX_FILE_SIZE = MAX_FILE_SIZE_MB * 1024 * 1024
const MAX_AI_PAGES = 10

// POST /api/templates/analyze
// multipart/form-data: { file: <any supported document> }
// Admin-only. Returns:
//   { analysis, pdf_base64, dimensions: { width, height, pageCount } }
//
// pdf_base64 is the canonical PDF (after convertToPdf), shipped back so
// the client can preview it AND POST the same bytes to /save without a
// second upload. We avoid persisting until the admin clicks Save.
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

  const inputBytes = new Uint8Array(await file.arrayBuffer())

  // 1) Get a canonical PDF (passthrough if already PDF; else LibreOffice).
  let pdfBytes: Uint8Array
  try {
    pdfBytes =
      ext === "pdf" ? inputBytes : await convertToPdf(inputBytes, file.name)
  } catch (err) {
    const message = err instanceof Error ? err.message : "Conversion failed"
    return NextResponse.json({ error: message }, { status: 500 })
  }

  // 2) Pull dimensions / page count straight from the PDF.
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

  // 3) Render every page (up to MAX_AI_PAGES) as PNG data URLs.
  const aiPageCount = Math.min(dimensions.pageCount, MAX_AI_PAGES)
  let imageDataUrls: string[]
  try {
    imageDataUrls = await fileToImageDataUrls(pdfBytes, "page.pdf", {
      maxPages: aiPageCount,
    })
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Page rendering failed"
    return NextResponse.json({ error: message }, { status: 500 })
  }

  // 4) Fan out: ask the AI per page in parallel. Page 1 sets issuer /
  //    form_name / form_code / confidence / reasoning; all pages
  //    contribute fields tagged with their page number. Per-page
  //    failures are non-fatal — we still ship whatever succeeded so
  //    the admin can review and re-run if needed.
  type PageResult =
    | { ok: true; page: number; analysis: TemplateAnalysis }
    | { ok: false; page: number; error: string }

  const results: PageResult[] = await Promise.all(
    imageDataUrls.map(async (url, idx) => {
      const page = idx + 1
      try {
        const analysis = await analyzeTemplate(url, {
          pageNumber: page,
          pageCount: aiPageCount,
        })
        return { ok: true as const, page, analysis }
      } catch (err) {
        const error = err instanceof Error ? err.message : "Analysis failed"
        return { ok: false as const, page, error }
      }
    }),
  )

  const firstOk = results.find(
    (r): r is Extract<PageResult, { ok: true }> => r.ok,
  )
  if (!firstOk) {
    return NextResponse.json(
      {
        error: "All pages failed to analyse",
        details: results.map((r) =>
          r.ok ? null : { page: r.page, error: r.error },
        ),
      },
      { status: 500 },
    )
  }

  type AnalysisField = TemplateAnalysis["fields"][number] & { page: number }
  const mergedFields: AnalysisField[] = []
  for (const r of results) {
    if (!r.ok) continue
    for (const f of r.analysis.fields) {
      mergedFields.push({ ...f, page: r.page })
    }
  }

  const analysis = {
    ...firstOk.analysis,
    fields: mergedFields,
  }

  const per_page = results.map((r) =>
    r.ok
      ? {
          page: r.page,
          field_count: r.analysis.fields.length,
          confidence: r.analysis.confidence,
          error: null,
        }
      : { page: r.page, field_count: 0, confidence: 0, error: r.error },
  )

  // 5) Return everything the client needs to drive the review UI.
  return NextResponse.json({
    analysis,
    dimensions,
    per_page,
    pdf_base64: Buffer.from(pdfBytes).toString("base64"),
    original_filename: file.name,
  })
}
