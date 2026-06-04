import { NextResponse } from "next/server"
import { createClient } from "@/lib/db/server"
import { extractDocument } from "@/lib/ai/extract-document"

type Params = { params: Promise<{ id: string }> }

// POST /api/documents/[id]/extract
// Reads the file from Storage, asks the AI to extract structured fields,
// stores the result on the document row, and returns the result for review.
export async function POST(_request: Request, { params }: Params) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { data: doc, error: readError } = await supabase
    .from("documents")
    .select("*")
    .eq("id", id)
    .single()

  if (readError || !doc) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 })
  }

  // v1: image extraction only. PDF support requires server-side rendering
  // and is planned for later.
  if (!doc.mime_type?.startsWith("image/")) {
    return NextResponse.json(
      {
        error:
          "Only image files (JPG/PNG) can be extracted in this version. For PDFs, take a screenshot of the page and upload that instead.",
      },
      { status: 400 }
    )
  }

  const { data: blob, error: downloadError } = await supabase.storage
    .from("documents")
    .download(doc.file_path)

  if (downloadError || !blob) {
    return NextResponse.json({ error: "Failed to read file" }, { status: 500 })
  }

  const buffer = Buffer.from(await blob.arrayBuffer())
  const dataUrl = `data:${doc.mime_type};base64,${buffer.toString("base64")}`

  try {
    const extracted = await extractDocument(dataUrl)

    // Cache the result on the document for future reference / debugging
    await supabase
      .from("documents")
      .update({ extracted_data: extracted })
      .eq("id", id)

    return NextResponse.json({ extracted })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Extraction failed"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
