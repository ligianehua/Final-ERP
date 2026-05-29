import { NextResponse } from "next/server"
import { createClient } from "@/lib/db/server"
import { personCreateSchema } from "@/lib/validations/person"

type Params = { params: Promise<{ id: string }> }

// GET /api/companies/[id]/people — list everyone attached to one entity
export async function GET(_request: Request, { params }: Params) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { data, error } = await supabase
    .from("company_people")
    .select("*")
    .eq("company_id", id)
    .order("created_at", { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ people: data })
}

// POST /api/companies/[id]/people — add a new person
export async function POST(request: Request, { params }: Params) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Confirm the parent company belongs to this user
  const { data: company, error: companyError } = await supabase
    .from("companies")
    .select("id")
    .eq("id", id)
    .single()

  if (companyError || !company) {
    return NextResponse.json({ error: "Company not found" }, { status: 404 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const parsed = personCreateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 422 }
    )
  }

  const { email, ...rest } = parsed.data
  const { data, error } = await supabase
    .from("company_people")
    .insert({
      ...rest,
      email: email || null,
      company_id: id,
      user_id: user.id,
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ person: data }, { status: 201 })
}
