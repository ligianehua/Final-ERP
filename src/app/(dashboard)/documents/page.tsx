import Link from "next/link"
import type { Metadata } from "next"
import { createClient } from "@/lib/db/server"
import { DOCUMENT_TYPE_LABELS } from "@/lib/validations/document"
import { CalendarX2, FileText, FolderOpen } from "lucide-react"

export const metadata: Metadata = { title: "Documents" }

type Document = {
  id: string
  company_id: string
  document_type: keyof typeof DOCUMENT_TYPE_LABELS
  document_number: string | null
  file_name: string
  file_size: number | null
  expiry_date: string | null
  created_at: string
}

function relativeExpiry(iso: string | null): {
  text: string
  tone: "past" | "soon" | "ok"
} | null {
  if (!iso) return null
  const target = new Date(`${iso}T00:00:00Z`).getTime()
  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)
  const days = Math.round((target - today.getTime()) / 86_400_000)
  if (days < 0)
    return {
      text: `Expired ${Math.abs(days)}d ago`,
      tone: "past",
    }
  if (days <= 30) return { text: `Expires in ${days}d`, tone: "soon" }
  return { text: `Expires ${iso}`, tone: "ok" }
}

function humanSize(bytes: number | null): string {
  if (!bytes) return ""
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export default async function DocumentsPage() {
  const supabase = await createClient()
  const [{ data: docs }, { data: companies }] = await Promise.all([
    supabase
      .from("documents")
      .select(
        "id, company_id, document_type, document_number, file_name, file_size, expiry_date, created_at",
      )
      .order("created_at", { ascending: false }),
    supabase.from("companies").select("id, name"),
  ])

  const documents = (docs ?? []) as Document[]
  const companyName = new Map(
    (companies ?? []).map((c) => [c.id, c.name as string]),
  )

  return (
    <div className="max-w-5xl mx-auto p-6 md:p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">Documents</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Every certificate uploaded across your archives. Click through to
          the company to manage them in their folder.
        </p>
      </div>

      {documents.length === 0 ? (
        <div className="border border-dashed border-border rounded-lg p-12 text-center">
          <div className="size-12 rounded-full bg-secondary flex items-center justify-center mx-auto mb-4">
            <FolderOpen className="size-6 text-muted-foreground" />
          </div>
          <h3 className="font-medium text-foreground mb-1">No documents yet</h3>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto mb-4">
            Open a company archive and upload your first certificate to see
            it here.
          </p>
          <Link
            href="/companies"
            className="text-sm font-medium text-foreground underline underline-offset-4"
          >
            Go to Companies
          </Link>
        </div>
      ) : (
        <ul className="divide-y divide-border border border-border rounded-lg">
          {documents.map((d) => {
            const exp = relativeExpiry(d.expiry_date)
            return (
              <li key={d.id}>
                <Link
                  href={`/companies/${d.company_id}`}
                  className="flex items-center gap-3 p-4 hover:bg-secondary/30 transition-colors"
                >
                  <div className="size-10 rounded-md bg-secondary flex items-center justify-center shrink-0">
                    <FileText className="size-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2">
                      <p className="text-sm font-medium truncate">
                        {DOCUMENT_TYPE_LABELS[d.document_type] ?? d.file_name}
                      </p>
                      {d.document_number && (
                        <span className="text-xs text-muted-foreground">
                          #{d.document_number}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5 flex flex-wrap gap-x-3">
                      <span>{companyName.get(d.company_id) ?? "Unknown"}</span>
                      {d.file_size && <span>· {humanSize(d.file_size)}</span>}
                      <span>
                        · Uploaded{" "}
                        {new Date(d.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  {exp && (
                    <span
                      className={
                        exp.tone === "past"
                          ? "text-xs inline-flex items-center gap-1 border border-destructive/30 bg-destructive/5 text-destructive rounded px-2 py-0.5"
                          : exp.tone === "soon"
                            ? "text-xs inline-flex items-center gap-1 border border-amber-500/30 bg-amber-500/5 text-amber-700 rounded px-2 py-0.5"
                            : "text-xs text-muted-foreground"
                      }
                    >
                      {exp.tone !== "ok" && <CalendarX2 className="size-3" />}
                      {exp.text}
                    </span>
                  )}
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
