import type { Metadata } from "next"
import Link from "next/link"
import { redirect } from "next/navigation"
import {
  CalendarClock,
  CheckCircle2,
  FileText,
  Globe,
  Plus,
} from "lucide-react"
import { createClient } from "@/lib/db/server"
import { isAdminEmail } from "@/lib/auth/admin"
import { getTemplateConfig } from "@/lib/forms/templates"
import { Button } from "@/components/ui/button"
import { TemplateDeleteButton } from "@/components/admin/template-delete-button"
import { TemplateImportButton } from "@/components/admin/template-import-button"
import { TemplateBulkExportButton } from "@/components/admin/template-bulk-export-button"
import { cn } from "@/lib/utils"

export const metadata: Metadata = { title: "Template catalog · Admin" }

const FREQUENCY_LABELS: Record<string, string> = {
  monthly: "Monthly",
  annual: "Annual",
  quarterly: "Quarterly",
  per_payment: "Per payment",
}

type DBRow = {
  form_code: string
  form_name: string
  agency: string
  frequency: string | null
  is_active: boolean
  pdf_storage_path: string | null
  source_url: string | null
  last_checked_at: string | null
  last_changed_at: string | null
  created_by: string | null
  created_at: string | null
}

const KNOWN_CODE_FORMS = ["BIR_2550M"] as const

export default async function AdminTemplatesPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/login")
  if (!isAdminEmail(user.email)) redirect("/dashboard")

  const { data: rows } = await supabase
    .from("form_templates")
    .select(
      "form_code, form_name, agency, frequency, is_active, pdf_storage_path, source_url, last_checked_at, last_changed_at, created_by, created_at",
    )
    .order("form_code")

  const dbRows = (rows ?? []) as DBRow[]
  const inDb = new Set(dbRows.map((r) => r.form_code))

  // Surface code-only templates that don't have a DB shadow row yet.
  const codeOnly: DBRow[] = KNOWN_CODE_FORMS.filter(
    (c) => !inDb.has(c),
  ).flatMap((c) => {
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
      },
    ]
  })

  const all = [...dbRows, ...codeOnly]

  return (
    <div className="max-w-6xl mx-auto p-6 md:p-8">
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Template catalog
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Every form Quill knows how to fill. Edit positions, watch source
            URLs for new versions, or add a new template from scratch.
          </p>
        </div>
        <div className="flex gap-2 shrink-0 flex-wrap justify-end">
          <TemplateBulkExportButton
            exportableCodes={dbRows.map((r) => r.form_code)}
          />
          <TemplateImportButton />
          <Button asChild size="sm" className="gap-2">
            <Link href="/admin/templates/new">
              <Plus className="size-4" />
              Add a template
            </Link>
          </Button>
        </div>
      </div>

      {all.length === 0 ? (
        <div className="border border-dashed border-border rounded-lg p-12 text-center">
          <div className="size-12 rounded-full bg-secondary flex items-center justify-center mx-auto mb-4">
            <FileText className="size-6 text-muted-foreground" />
          </div>
          <h3 className="font-medium text-foreground mb-1">
            No templates yet
          </h3>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto">
            Click <span className="font-medium">Add a template</span> and drop
            any government or bank form — Quill takes it from there.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-border border border-border rounded-lg overflow-hidden">
          {all.map((t) => {
            const codeOnly = !inDb.has(t.form_code)
            const changedHere =
              t.last_changed_at &&
              t.last_checked_at &&
              t.last_changed_at >= t.last_checked_at
            return (
              <li
                key={t.form_code}
                className="flex items-center gap-3 p-4 bg-background hover:bg-secondary/30 transition-colors"
              >
                <div className="size-10 rounded-md bg-secondary flex items-center justify-center shrink-0">
                  <FileText className="size-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <Link
                      href={`/admin/templates/${t.form_code}`}
                      className="text-sm font-medium hover:underline"
                    >
                      {t.form_name || t.form_code}
                    </Link>
                    <span className="text-xs text-muted-foreground font-mono">
                      {t.form_code}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5 flex flex-wrap gap-x-3 gap-y-1">
                    {t.agency && <span>{t.agency}</span>}
                    {t.frequency && (
                      <span>
                        · {FREQUENCY_LABELS[t.frequency] ?? t.frequency}
                      </span>
                    )}
                    {codeOnly && (
                      <span className="inline-flex items-center gap-1 text-blue-700">
                        · Code default (not yet edited)
                      </span>
                    )}
                    {t.source_url && (
                      <span className="inline-flex items-center gap-1">
                        ·
                        <Globe className="size-3" />
                        <a
                          href={t.source_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:underline"
                        >
                          source
                        </a>
                      </span>
                    )}
                    {t.last_checked_at && (
                      <span className="inline-flex items-center gap-1">
                        ·
                        <CalendarClock className="size-3" />
                        Checked{" "}
                        {new Date(t.last_checked_at).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>
                <span
                  className={cn(
                    "text-xs border rounded px-2 py-0.5 shrink-0",
                    !t.is_active
                      ? "text-muted-foreground"
                      : changedHere
                        ? "text-amber-700 border-amber-500/30 bg-amber-500/5"
                        : "text-green-700 border-green-600/30 bg-green-600/5",
                  )}
                >
                  {!t.is_active ? (
                    "Disabled"
                  ) : changedHere ? (
                    "Source updated"
                  ) : (
                    <span className="inline-flex items-center gap-1">
                      <CheckCircle2 className="size-3" />
                      Active
                    </span>
                  )}
                </span>
                {!codeOnly && (
                  <TemplateDeleteButton
                    formCode={t.form_code}
                    formName={t.form_name || t.form_code}
                  />
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
