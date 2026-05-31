import { NextResponse } from "next/server"
import { z } from "zod"
import { createClient } from "@/lib/db/server"
import { getFormSchema } from "@/lib/forms/registry"
import { fillFromArchive } from "@/lib/forms/fill"
import type { Company, CompanyPerson } from "@/types"

const bodySchema = z.object({
  form_code: z.string().min(1),
  company_id: z.string().uuid(),
  signatory_id: z.string().uuid().nullable().optional(),
})

// POST /api/forms/fill
// Returns the schema + filled-from-archive values + the chosen signatory.
// Does NOT persist anything — that happens via POST /api/submissions.
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

  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 422 }
    )
  }

  const schema = getFormSchema(parsed.data.form_code)
  if (!schema) {
    return NextResponse.json(
      { error: `Form ${parsed.data.form_code} cannot be filled yet (no field schema).` },
      { status: 400 }
    )
  }

  const [{ data: company, error: companyError }, { data: peopleRaw }] = await Promise.all([
    supabase.from("companies").select("*").eq("id", parsed.data.company_id).single(),
    supabase
      .from("company_people")
      .select("*")
      .eq("company_id", parsed.data.company_id),
  ])

  if (companyError || !company) {
    return NextResponse.json({ error: "Company not found" }, { status: 404 })
  }

  const people = (peopleRaw ?? []) as CompanyPerson[]
  const { fields, signatory } = fillFromArchive(
    schema,
    company as Company,
    people,
    parsed.data.signatory_id ?? undefined
  )

  return NextResponse.json({
    form: { form_code: schema.form_code, form_name: schema.form_name, agency: schema.agency },
    company: { id: company.id, name: company.name, entity_type: company.entity_type },
    people: people.map((p) => ({
      id: p.id,
      full_name: p.full_name,
      role: p.role,
      position_title: p.position_title,
    })),
    signatory_id: signatory?.id ?? null,
    fields,
  })
}
