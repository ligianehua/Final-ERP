import type { Metadata } from "next"
import Link from "next/link"
import { redirect } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import { createClient } from "@/lib/db/server"
import { isAdminEmail } from "@/lib/auth/admin"
import { TemplateUploadFlow } from "@/components/templates/template-upload-flow"

export const metadata: Metadata = { title: "Add a form template" }

export default async function NewTemplatePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/login")
  if (!isAdminEmail(user.email)) {
    // Hide existence of the admin area from non-admins.
    redirect("/dashboard")
  }

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
        <h1 className="text-2xl font-semibold tracking-tight">
          Add a form template
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Drop a government or bank form. Quill reads it, identifies the
          issuer, lists the fields, and stages a first-pass coord map you can
          drag-correct in the editor.
        </p>
      </div>

      <TemplateUploadFlow />
    </div>
  )
}
