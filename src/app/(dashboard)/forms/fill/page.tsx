import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { FillFlow } from "@/components/forms/fill-flow"
import { getFormSchema } from "@/lib/forms/registry"
import { notFound } from "next/navigation"

export default async function FillFormPage({
  searchParams,
}: {
  searchParams: Promise<{ form_code?: string }>
}) {
  const { form_code } = await searchParams
  if (!form_code) notFound()

  const schema = getFormSchema(form_code)
  if (!schema) notFound()

  return (
    <div className="max-w-3xl mx-auto p-6 md:p-8">
      <Link
        href="/forms"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6"
      >
        <ArrowLeft className="size-4" />
        Back to Forms
      </Link>

      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">Fill {schema.form_name}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {schema.agency} · {schema.form_code} — pick an archive, review the filled fields, save as draft.
        </p>
      </div>

      <FillFlow formCode={form_code} />
    </div>
  )
}
