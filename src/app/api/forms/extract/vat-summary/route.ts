import { NextResponse } from "next/server"
import { createClient } from "@/lib/db/server"
import { extractVATSummary } from "@/lib/ai/extract-vat"
import { fileToImageDataUrl } from "@/lib/ai/file-to-image"
import {
  getExtension,
  isSupportedExtension,
} from "@/lib/convert/supported"

export const runtime = "nodejs"
export const maxDuration = 90

const MAX_FILE_SIZE_MB = 25
const MAX_FILE_SIZE = MAX_FILE_SIZE_MB * 1024 * 1024

// POST /api/forms/extract/vat-summary
// multipart/form-data: { file }
// → { extracted: { gross_sales, output_tax, input_tax, vat_payable, period,
//                  confidence, reasoning } }
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

  const bytes = new Uint8Array(await file.arrayBuffer())

  let imageUrl: string
  try {
    imageUrl = await fileToImageDataUrl(bytes, file.name)
  } catch (err) {
    const message = err instanceof Error ? err.message : "File conversion failed"
    return NextResponse.json({ error: message }, { status: 500 })
  }

  try {
    const extracted = await extractVATSummary(imageUrl)
    return NextResponse.json({ extracted })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Extraction failed"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
