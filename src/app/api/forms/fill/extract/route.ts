import { NextResponse } from "next/server"
import { createClient } from "@/lib/db/server"
import {
  getExtension,
  isSupportedExtension,
} from "@/lib/convert/supported"
import { fileToImageDataUrl } from "@/lib/ai/file-to-image"
import {
  extractFormFields,
  type FormFieldSpec,
} from "@/lib/ai/extract-form-fields"

export const runtime = "nodejs"
export const maxDuration = 90

const MAX_FILE_SIZE_MB = 20
const MAX_FILE_SIZE = MAX_FILE_SIZE_MB * 1024 * 1024

// POST /api/forms/fill/extract
// multipart/form-data: { file, form_code }
// Authenticated users. Reads the upload as an image, asks the AI to
// extract values for each field in the form's schema, returns the
// values for the client to merge into its in-progress fill state.
//
// Only page 1 is sent to the model — fill-from-scan is meant for
// receipts / certificates / quick refs, not multi-page forms.
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
  const formCode = formData.get("form_code")
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "Missing 'file'" }, { status: 400 })
  }
  if (typeof formCode !== "string" || !formCode) {
    return NextResponse.json(
      { error: "Missing 'form_code'" },
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

  // Pull the field schema so the AI knows what to look for.
  const { data: row } = await supabase
    .from("form_templates")
    .select("field_schema")
    .eq("form_code", formCode)
    .maybeSingle()
  const schema = row?.field_schema as
    | {
        fields: Array<{
          id: string
          label: string
          semantic_type: string
        }>
      }
    | null
  if (!schema?.fields || schema.fields.length === 0) {
    return NextResponse.json(
      { error: "No schema for this form" },
      { status: 404 },
    )
  }
  const fields: FormFieldSpec[] = schema.fields.map((f) => ({
    id: f.id,
    label: f.label,
    semantic_type: f.semantic_type,
  }))

  // Render page 1 of the upload as a vision-ready data URL.
  let imageDataUrl: string
  try {
    const bytes = new Uint8Array(await file.arrayBuffer())
    imageDataUrl = await fileToImageDataUrl(bytes, file.name)
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Image conversion failed"
    return NextResponse.json({ error: message }, { status: 500 })
  }

  let values: Record<string, string | null>
  try {
    values = await extractFormFields(imageDataUrl, fields)
  } catch (err) {
    const message = err instanceof Error ? err.message : "AI extraction failed"
    return NextResponse.json({ error: message }, { status: 500 })
  }

  const hits = Object.values(values).filter((v) => v !== null).length
  return NextResponse.json({
    values,
    field_count: fields.length,
    hit_count: hits,
  })
}
