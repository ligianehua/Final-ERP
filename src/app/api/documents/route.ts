import { NextResponse } from "next/server"
import { createClient } from "@/lib/db/server"
import { documentCreateSchema } from "@/lib/validations/document"

// GET /api/documents?company_id=... — list documents (optionally for one company)
export async function GET(request: Request) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const url = new URL(request.url)
  const companyId = url.searchParams.get("company_id")

  let query = supabase
    .from("documents")
    .select("*")
    .order("created_at", { ascending: false })

  if (companyId) {
    query = query.eq("company_id", companyId)
  }

  const { data, error } = await query
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ documents: data })
}

// POST /api/documents — record a document after the client uploads the file
// to Storage. The file_path is the Storage key chosen by the client.
export async function POST(request: Request) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const parsed = documentCreateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 422 }
    )
  }

  // Sanity check: file_path must live under this user's folder.
  if (!parsed.data.file_path.startsWith(`${user.id}/`)) {
    return NextResponse.json({ error: "Invalid file path" }, { status: 403 })
  }

  // Confirm the company belongs to this user (RLS would also catch this
  // on insert, but failing early gives a clearer error).
  const { data: company, error: companyError } = await supabase
    .from("companies")
    .select("id")
    .eq("id", parsed.data.company_id)
    .single()

  if (companyError || !company) {
    return NextResponse.json({ error: "Company not found" }, { status: 404 })
  }

  const { data, error } = await supabase
    .from("documents")
    .insert({
      ...parsed.data,
      user_id: user.id,
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ document: data }, { status: 201 })
}
