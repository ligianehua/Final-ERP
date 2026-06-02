import { NextResponse } from "next/server"
import { PDFDocument } from "pdf-lib"
import { createClient } from "@/lib/db/server"
import { isAdminEmail } from "@/lib/auth/admin"
import { convertToPdf } from "@/lib/convert/to-pdf"
import {
  getExtension,
  isSupportedExtension,
} from "@/lib/convert/supported"
import { fileToImageDataUrl } from "@/lib/ai/file-to-image"
import { analyzeTemplate } from "@/lib/ai/analyze-template"

export const runtime = "nodejs"
export const maxDuration = 120

const MAX_FILE_SIZE_MB = 25
const MAX_FILE_SIZE = MAX_FILE_SIZE_MB * 1024 * 1024

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

  // 3) Render page 1 as a PNG data URL for the vision model.
  let imageDataUrl: string
  try {
    imageDataUrl = await fileToImageDataUrl(pdfBytes, "page.pdf")
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Page rendering failed"
    return NextResponse.json({ error: message }, { status: 500 })
  }

  // 4) Ask the AI to identify issuer, form, and fields.
  let analysis
  try {
    analysis = await analyzeTemplate(imageDataUrl)
  } catch (err) {
    const message = err instanceof Error ? err.message : "Analysis failed"
    return NextResponse.json({ error: message }, { status: 500 })
  }

  // 5) Return everything the client needs to drive the review UI.
  return NextResponse.json({
    analysis,
    dimensions,
    pdf_base64: Buffer.from(pdfBytes).toString("base64"),
    original_filename: file.name,
  })
}
