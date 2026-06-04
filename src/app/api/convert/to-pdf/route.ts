import { NextResponse } from "next/server"
import { createClient } from "@/lib/db/server"
import {
  ConversionError,
  convertToPdf,
} from "@/lib/convert/to-pdf"
import {
  getExtension,
  isSupportedExtension,
} from "@/lib/convert/supported"

// LibreOffice needs a Node runtime (child_process); Edge can't spawn it.
export const runtime = "nodejs"
export const maxDuration = 90

const MAX_FILE_SIZE_MB = 25
const MAX_FILE_SIZE = MAX_FILE_SIZE_MB * 1024 * 1024

// POST /api/convert/to-pdf
// multipart/form-data: { file: <any supported document> }
// Returns: application/pdf
export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
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
    return NextResponse.json(
      { error: "Missing 'file' field" },
      { status: 400 },
    )
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

  const bytes = new Uint8Array(await file.arrayBuffer())
  let pdfBytes: Uint8Array
  try {
    pdfBytes = await convertToPdf(bytes, file.name)
  } catch (err) {
    const message =
      err instanceof ConversionError ? err.message : "Conversion failed"
    return NextResponse.json({ error: message }, { status: 500 })
  }

  const baseName = file.name.replace(/\.[^.]+$/, "") || "document"
  const downloadName = `${baseName}.pdf`

  return new Response(new Uint8Array(pdfBytes), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${downloadName}"`,
      "Content-Length": String(pdfBytes.byteLength),
    },
  })
}
