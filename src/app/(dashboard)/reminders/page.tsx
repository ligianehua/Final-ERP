import { createClient } from "@/lib/db/server"
import { Bell, Building2, CalendarClock } from "lucide-react"
import { RecomputeRemindersButton } from "@/components/reminders/recompute-button"
import { ReminderActions } from "@/components/reminders/reminder-actions"

type Reminder = {
  id: string
  company_id: string
  reminder_type: "document_expiry" | "form_deadline"
  title: string
  due_date: string
  target_date: string | null
}

function relativeDays(iso: string): { label: string; tone: "past" | "soon" | "far" } {
  const due = new Date(`${iso}T00:00:00Z`)
  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)
  const diffMs = due.getTime() - today.getTime()
  const days = Math.round(diffMs / 86_400_000)
  if (days < 0) return { label: `${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"} ago`, tone: "past" }
  if (days === 0) return { label: "today", tone: "soon" }
  if (days === 1) return { label: "tomorrow", tone: "soon" }
  if (days <= 7) return { label: `in ${days} days`, tone: "soon" }
  return { label: `in ${days} days`, tone: "far" }
}

export default async function RemindersPage() {
  const supabase = await createClient()
  const today = new Date().toISOString().slice(0, 10)

  const [{ data: rems }, { data: companies }] = await Promise.all([
    supabase
      .from("reminders")
      .select("id, company_id, reminder_type, title, due_date, target_date")
      .is("dismissed_at", null)
      .or(`snoozed_until.is.null,snoozed_until.lte.${today}`)
      .order("due_date", { ascending: true }),
    supabase.from("companies").select("id, name"),
  ])

  const reminders = (rems ?? []) as Reminder[]
  const companyName = new Map((companies ?? []).map((c) => [c.id, c.name as string]))

  // Group by company. Map preserves insertion order; sort companies by
  // earliest-due reminder.
  const byCompany = new Map<string, Reminder[]>()
  for (const r of reminders) {
    const list = byCompany.get(r.company_id) ?? []
    list.push(r)
    byCompany.set(r.company_id, list)
  }

  return (
    <div className="max-w-5xl mx-auto p-6 md:p-8">
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Reminders</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Document expiries you should know about — generated automatically
            at <span className="font-mono">90 / 30 / 14 / 7</span> days out.
          </p>
        </div>
        <RecomputeRemindersButton />
      </div>

      {reminders.length === 0 ? (
        <div className="border border-dashed border-border rounded-lg p-12 text-center">
          <div className="size-12 rounded-full bg-secondary flex items-center justify-center mx-auto mb-4">
            <Bell className="size-6 text-muted-foreground" />
          </div>
          <h3 className="font-medium text-foreground mb-1">No active reminders</h3>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto">
            Upload a document with an expiry date (Mayor&apos;s Permit, BIR
            certificate, etc.) and reminders will appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {Array.from(byCompany.entries()).map(([cid, rows]) => (
            <section key={cid}>
              <h2 className="text-sm font-medium mb-2 flex items-center gap-2">
                <Building2 className="size-4 text-muted-foreground" />
                {companyName.get(cid) ?? "Unknown company"}
                <span className="text-xs text-muted-foreground">· {rows.length}</span>
              </h2>
              <ul className="divide-y divide-border border border-border rounded-lg">
                {rows.map((r) => {
                  const rel = relativeDays(r.due_date)
                  const toneCls =
                    rel.tone === "past"
                      ? "text-destructive border-destructive/30 bg-destructive/5"
                      : rel.tone === "soon"
                        ? "text-amber-700 border-amber-500/30 bg-amber-500/5"
                        : "text-muted-foreground border-border bg-secondary/40"
                  return (
                    <li key={r.id} className="flex items-center gap-3 p-4">
                      <div className="size-10 rounded-md bg-secondary flex items-center justify-center shrink-0">
                        <CalendarClock className="size-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">{r.title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Due {r.due_date}
                          {r.target_date && (
                            <span> · Expires {r.target_date}</span>
                          )}
                        </p>
                      </div>
                      <span className={`text-xs border rounded px-2 py-0.5 ${toneCls}`}>
                        {rel.label}
                      </span>
                      <ReminderActions reminderId={r.id} />
                    </li>
                  )
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
