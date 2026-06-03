import { NextResponse } from "next/server"
import { createClient } from "@/lib/db/server"
import { isAdminEmail } from "@/lib/auth/admin"
import { getEffectiveTemplate } from "@/lib/forms/templates/effective"
import { loadTemplateBytes } from "@/lib/forms/render-on-template"
import { listAcroFormWidgets } from "@/lib/forms/templates/acroform-fields"

export const runtime = "nodejs"

type Params = { params: Promise<{ form_code: string }> }

// GET /api/forms/templates/[form_code]/acroform-fields
// Admin-only. Returns the AcroForm widget names embedded in the PDF
// so the mapping editor can show "schema field -> PDF widget"
// dropdowns. Cached at the route level via Next's default fetch
// caching — admins re-uploading the PDF goes through replace-pdf
// which revalidates.
export async function GET(_request: Request, { params }: Params) {
  const { form_code } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!isAdminEmail(user.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const template = await getEffectiveTemplate(form_code)
  if (!template) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  try {
    const bytes = await loadTemplateBytes(template)
    const widgets = await listAcroFormWidgets(bytes)
    return NextResponse.json({ widgets })
  } catch (err) {
    const msg = err instanceof Error ? err.message : "PDF parse failed"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
