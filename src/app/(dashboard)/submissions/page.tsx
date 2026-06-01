import { createClient } from "@/lib/db/server"
import { getFormSchema } from "@/lib/forms/registry"
import { SubmissionActions } from "@/components/submissions/submission-actions"
import { FileText, History as HistoryIcon } from "lucide-react"

type Submission = {
  id: string
  company_id: string
  form_code: string
  status: "draft" | "completed" | "filed"
  period: string | null
  output_pdf_path: string | null
  updated_at: string
  created_at: string
}

const STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  completed: "Completed",
  filed: "Filed",
}

export default async function SubmissionsPage() {
  const supabase = await createClient()

  const [{ data: subs }, { data: companies }] = await Promise.all([
    supabase
      .from("form_submissions")
      .select("*")
      .order("updated_at", { ascending: false }),
    supabase.from("companies").select("id, name"),
  ])

  const submissions = (subs ?? []) as Submission[]
  const companyMap = new Map((companies ?? []).map((c) => [c.id, c.name as string]))

  return (
    <div className="max-w-5xl mx-auto p-6 md:p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">History</h1>
        <p className="text-sm text-muted-foreground mt-1">
          All form submissions — drafts, completed, and filed.
        </p>
      </div>

      {submissions.length === 0 ? (
        <div className="border border-dashed border-border rounded-lg p-12 text-center">
          <div className="size-12 rounded-full bg-secondary flex items-center justify-center mx-auto mb-4">
            <HistoryIcon className="size-6 text-muted-foreground" />
          </div>
          <h3 className="font-medium text-foreground mb-1">No submissions yet</h3>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto">
            Recognize a form and fill it from your archive — drafts appear here.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-border border border-border rounded-lg">
          {submissions.map((s) => {
            const schema = getFormSchema(s.form_code)
            const formName = schema?.form_name ?? s.form_code
            const companyName = companyMap.get(s.company_id) ?? "Unknown"
            return (
              <li key={s.id} className="flex items-center gap-3 p-4">
                <div className="size-10 rounded-md bg-secondary flex items-center justify-center shrink-0">
                  <FileText className="size-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <p className="text-sm font-medium">{formName}</p>
                    <span className="text-xs text-muted-foreground">
                      {s.form_code}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5 flex flex-wrap gap-x-3">
                    <span>{companyName}</span>
                    {s.period && <span>· Period: {s.period}</span>}
                    <span>· Updated {new Date(s.updated_at).toLocaleString()}</span>
                  </div>
                </div>
                <span
                  className={
                    s.status === "draft"
                      ? "text-xs border border-border rounded px-2 py-0.5 text-muted-foreground"
                      : s.status === "completed"
                        ? "text-xs border border-green-600/30 bg-green-600/10 rounded px-2 py-0.5 text-green-700"
                        : "text-xs border border-blue-600/30 bg-blue-600/10 rounded px-2 py-0.5 text-blue-700"
                  }
                >
                  {STATUS_LABEL[s.status]}
                </span>
                {schema && (
                  <SubmissionActions
                    submissionId={s.id}
                    formCode={s.form_code}
                    formName={formName}
                    outputPdfPath={s.output_pdf_path}
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
