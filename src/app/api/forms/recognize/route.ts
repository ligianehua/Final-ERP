import { NextResponse } from "next/server"
import { createClient } from "@/lib/db/server"
import { recognizeForm } from "@/lib/ai/recognize-form"

const MAX_BYTES = 10 * 1024 * 1024 // 10 MB

// POST /api/forms/recognize
// multipart/form-data with field "file" — a JPG/PNG of a (typically blank)
// government form. Returns { form_code, form_name, agency, confidence, reasoning }.
// We do NOT persist the image; this is a probe step.
export async function POST(request: Request) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const formData = await request.formData().catch(() => null)
  if (!formData) {
    return NextResponse.json({ error: "Invalid multipart body" }, { status: 400 })
  }

  const file = formData.get("file")
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing 'file' field" }, { status: 400 })
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "File too large (max 10 MB)" }, { status: 413 })
  }

  if (!file.type.startsWith("image/")) {
    return NextResponse.json(
      { error: "Only image files (JPG/PNG) are supported for v1." },
      { status: 415 }
    )
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  const dataUrl = `data:${file.type};base64,${buffer.toString("base64")}`

  try {
    const result = await recognizeForm(dataUrl)
    return NextResponse.json({ result })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Recognition failed"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
