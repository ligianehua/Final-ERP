import { NextResponse } from "next/server"
import { z } from "zod"
import { createClient } from "@/lib/db/server"
import { getFormSchema } from "@/lib/forms/registry"

const createSchema = z.object({
  form_code: z.string().min(1),
  company_id: z.string().uuid(),
  period: z.string().max(20).nullable().optional(),
  field_values: z.record(z.string(), z.string().nullable()),
})

// GET /api/submissions — list all submissions for the current user
export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const url = new URL(request.url)
  const companyId = url.searchParams.get("company_id")

  let query = supabase
    .from("form_submissions")
    .select("*")
    .order("updated_at", { ascending: false })

  if (companyId) query = query.eq("company_id", companyId)

  const { data, error } = await query
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ submissions: data })
}

// POST /api/submissions — save a draft submission
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

  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 422 }
    )
  }

  if (!getFormSchema(parsed.data.form_code)) {
    return NextResponse.json({ error: "Unsupported form_code" }, { status: 400 })
  }

  const { data, error } = await supabase
    .from("form_submissions")
    .insert({
      user_id: user.id,
      company_id: parsed.data.company_id,
      form_code: parsed.data.form_code,
      period: parsed.data.period ?? null,
      field_values: parsed.data.field_values,
      status: "draft",
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ submission: data }, { status: 201 })
}
