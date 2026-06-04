import { NextResponse } from "next/server"
import { createClient } from "@/lib/db/server"
import { isAdminEmail } from "@/lib/auth/admin"
import { fileToImageDataUrls } from "@/lib/ai/file-to-image"
import {
  analyzeTemplate,
  type TemplateAnalysis,
} from "@/lib/ai/analyze-template"

export const runtime = "nodejs"
export const maxDuration = 300

const MAX_AI_PAGES = 10

type Params = { params: Promise<{ form_code: string }> }

// POST /api/forms/templates/[form_code]/reanalyze
// Admin-only. Re-runs the vision model on the template's currently
// stored PDF. Returns the same shape as /api/templates/analyze but
// without pdf_base64 — this is "what would the AI suggest TODAY?"
// purely for the diff/merge dialog. Nothing is persisted; the caller
// PATCHes whatever subset of the returned fields it wants.
export async function POST(_request: Request, { params }: Params) {
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
    .select("pdf_storage_path, dimensions")
    .eq("form_code", form_code)
    .maybeSingle()
  if (!row?.pdf_storage_path) {
    return NextResponse.json(
      {
        error:
          "No stored PDF for this template. Replace the PDF first, or re-upload via the catalog.",
      },
      { status: 404 },
    )
  }

  // 1) Download the PDF bytes from Storage.
  let pdfBytes: Uint8Array
  try {
    const { data: blob, error } = await supabase.storage
      .from("templates")
      .download(row.pdf_storage_path)
    if (error || !blob) {
      return NextResponse.json(
        { error: `Could not fetch stored PDF: ${error?.message ?? "missing"}` },
        { status: 500 },
      )
    }
    pdfBytes = new Uint8Array(await blob.arrayBuffer())
  } catch (err) {
    const message = err instanceof Error ? err.message : "Storage read failed"
    return NextResponse.json({ error: message }, { status: 500 })
  }

  // 2) Pick page count from the stored dimensions (clamped).
  const storedDims = (row.dimensions ?? {}) as {
    width?: number
    height?: number
    pageCount?: number
  }
  const aiPageCount = Math.min(storedDims.pageCount ?? 1, MAX_AI_PAGES)

  // 3) Rasterise + fan out (mirrors /api/templates/analyze).
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

  const analysis = { ...firstOk.analysis, fields: mergedFields }
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

  return NextResponse.json({
    analysis,
    dimensions: storedDims,
    per_page,
  })
}
