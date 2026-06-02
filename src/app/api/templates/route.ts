import { NextResponse } from "next/server"
import { createClient } from "@/lib/db/server"
import { isAdminEmail } from "@/lib/auth/admin"
import { getTemplateConfig } from "@/lib/forms/templates"

// GET /api/templates
// Admin-only: list every form_templates row (active + inactive) for the
// admin catalog. Also enumerates code-shipped templates that don't yet
// have a DB shadow row so the admin can see the full catalog in one
// place.
export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  if (!isAdminEmail(user.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { data: rows, error } = await supabase
    .from("form_templates")
    .select(
      "form_code, form_name, agency, frequency, is_active, pdf_storage_path, source_url, last_checked_at, last_changed_at, created_by, created_at",
    )
    .order("form_code")
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Surface code-shipped templates that don't yet have a DB row so the
  // admin sees the complete catalog. (Once any edit hits the API the
  // row gets upserted, so this list of "code-only" rows naturally
  // shrinks over time.)
  const inDb = new Set((rows ?? []).map((r) => r.form_code))
  // Known code-side codes: we hard-list rather than re-export from the
  // registry to avoid pulling in pdf-lib transitive deps at runtime.
  const KNOWN_CODE_FORMS = ["BIR_2550M"] as const
  const codeOnly = KNOWN_CODE_FORMS.filter((c) => !inDb.has(c)).flatMap((c) => {
    const t = getTemplateConfig(c)
    if (!t) return []
    return [
      {
        form_code: c,
        form_name: c,
        agency: "",
        frequency: null,
        is_active: true,
        pdf_storage_path: null,
        source_url: null,
        last_checked_at: null,
        last_changed_at: null,
        created_by: null,
        created_at: null,
        is_code_only: true as const,
      },
    ]
  })

  return NextResponse.json({
    templates: [
      ...(rows ?? []).map((r) => ({ ...r, is_code_only: false as const })),
      ...codeOnly,
    ],
  })
}
