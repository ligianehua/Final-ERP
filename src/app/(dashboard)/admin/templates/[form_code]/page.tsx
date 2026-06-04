import Link from "next/link"
import type { Metadata } from "next"
import { notFound, redirect } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import { createClient } from "@/lib/db/server"
import { isAdminEmail } from "@/lib/auth/admin"
import {
  getEffectiveTemplate,
  serializeTemplate,
} from "@/lib/forms/templates/effective"
import { getEffectiveFormSchema } from "@/lib/forms/registry-effective"
import { TemplateDetailEditor } from "@/components/admin/template-detail-editor"
import { TemplateDeleteButton } from "@/components/admin/template-delete-button"

type Params = { params: Promise<{ form_code: string }> }

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { form_code } = await params
  return { title: `${form_code} · Template admin` }
}

export default async function AdminTemplateDetailPage({ params }: Params) {
  const { form_code } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/login")
  if (!isAdminEmail(user.email)) redirect("/dashboard")

  const [effective, schema, { data: row }] = await Promise.all([
    getEffectiveTemplate(form_code),
    getEffectiveFormSchema(form_code),
    supabase
      .from("form_templates")
      .select(
        "form_code, form_name, agency, frequency, description, is_active, source_url, last_checked_at, last_changed_at, created_at, pdf_storage_path",
      )
      .eq("form_code", form_code)
      .maybeSingle(),
  ])

  if (!effective) notFound()

  // For code-only templates we synthesise minimal metadata so the form
  // renders even before the first admin edit creates a DB row.
  const meta = {
    form_code,
    form_name: row?.form_name ?? schema?.form_name ?? form_code,
    agency: row?.agency ?? schema?.agency ?? "",
    frequency: row?.frequency ?? null,
    description: row?.description ?? null,
    is_active: row?.is_active ?? true,
    source_url: row?.source_url ?? null,
    last_checked_at: row?.last_checked_at ?? null,
    last_changed_at: row?.last_changed_at ?? null,
    created_at: row?.created_at ?? null,
  }

  const template = serializeTemplate(form_code, effective)

  return (
    <div className="max-w-5xl mx-auto p-6 md:p-8">
      <Link
        href="/admin/templates"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6"
      >
        <ArrowLeft className="size-4" />
        Back to catalog
      </Link>

      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {meta.form_name || form_code}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            <span className="font-mono">{form_code}</span>
            {meta.agency && ` · ${meta.agency}`}
          </p>
        </div>
        {row?.pdf_storage_path && (
          <TemplateDeleteButton formCode={form_code} formName={meta.form_name} />
        )}
      </div>

      <TemplateDetailEditor
        template={template}
        meta={meta}
        fieldSchema={schema}
      />
    </div>
  )
}
