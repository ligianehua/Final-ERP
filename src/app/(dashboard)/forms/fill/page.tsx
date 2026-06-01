import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { FillFlow, type InitialSubmission } from "@/components/forms/fill-flow"
import { createClient } from "@/lib/db/server"
import { isAdminEmail } from "@/lib/auth/admin"
import { getFormSchema } from "@/lib/forms/registry"
import {
  getEffectiveTemplate,
  serializeTemplate,
} from "@/lib/forms/templates/effective"
import { notFound } from "next/navigation"

type SearchParams = {
  form_code?: string
  submission_id?: string
}

export default async function FillFormPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const { form_code, submission_id } = await searchParams
  if (!form_code) notFound()

  const schema = getFormSchema(form_code)
  if (!schema) notFound()

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const isAdmin = isAdminEmail(user?.email)

  // Effective coord-map: DB override if an admin has saved one, else
  // the factory default from src/lib/forms/templates/<form>.ts.
  const effective = await getEffectiveTemplate(form_code)
  const template = effective ? serializeTemplate(effective) : null

  let initial: InitialSubmission | undefined
  if (submission_id) {
    const { data } = await supabase
      .from("form_submissions")
      .select("id, company_id, period, field_values, field_overrides")
      .eq("id", submission_id)
      .single()
    if (data) {
      initial = {
        id: data.id,
        companyId: data.company_id,
        period: data.period ?? "",
        values: Object.fromEntries(
          Object.entries(
            (data.field_values ?? {}) as Record<string, string | null>,
          ).map(([k, v]) => [k, v ?? ""]),
        ),
        overrides: (data.field_overrides ?? {}) as Record<
          string,
          { dx: number; dy: number }
        >,
      }
    }
  }

  const editing = !!initial
  return (
    <div className="max-w-3xl mx-auto p-6 md:p-8">
      <Link
        href={editing ? "/submissions" : "/forms"}
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6"
      >
        <ArrowLeft className="size-4" />
        {editing ? "Back to History" : "Back to Forms"}
      </Link>

      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">
          {editing ? `Edit ${schema.form_name}` : `Fill ${schema.form_name}`}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {schema.agency} · {schema.form_code}
          {editing
            ? " — your saved values and layout overrides have been restored."
            : " — pick an archive, review the filled fields, save as draft."}
        </p>
      </div>

      <FillFlow
        formCode={form_code}
        template={template}
        isAdmin={isAdmin}
        initial={initial}
      />
    </div>
  )
}
