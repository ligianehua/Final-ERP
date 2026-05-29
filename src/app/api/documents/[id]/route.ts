import { NextResponse } from "next/server"
import { createClient } from "@/lib/db/server"

type Params = { params: Promise<{ id: string }> }

// DELETE /api/documents/[id] — remove both the Storage object and the row
export async function DELETE(_request: Request, { params }: Params) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Read first so we know the file_path to remove from Storage
  const { data: doc, error: readError } = await supabase
    .from("documents")
    .select("id, file_path")
    .eq("id", id)
    .single()

  if (readError || !doc) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 })
  }

  // Best-effort Storage deletion. Even if it fails, drop the row so the user
  // isn't blocked; orphan files can be cleaned up later.
  await supabase.storage.from("documents").remove([doc.file_path])

  const { error } = await supabase.from("documents").delete().eq("id", id)
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
