import Link from "next/link"
import type { Metadata } from "next"
import { createClient } from "@/lib/db/server"
import {
  Activity,
  Bell,
  CalendarClock,
  ChevronRight,
  FileCheck,
  FileText,
} from "lucide-react"
import { getFormSchema } from "@/lib/forms/registry"
import { DOCUMENT_TYPE_LABELS } from "@/lib/validations/document"

export const metadata: Metadata = { title: "Dashboard" }

type Reminder = {
  id: string
  company_id: string
  title: string
  due_date: string
}

type Document = {
  id: string
  company_id: string
  document_type: keyof typeof DOCUMENT_TYPE_LABELS
  file_name: string
  created_at: string
}

type Submission = {
  id: string
  company_id: string
  form_code: string
  status: string
  updated_at: string
  created_at: string
}

function relativeDays(iso: string): string {
  const target = new Date(`${iso}T00:00:00Z`)
  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)
  const days = Math.round(
    (target.getTime() - today.getTime()) / 86_400_000,
  )
  if (days < 0) return `${Math.abs(days)}d ago`
  if (days === 0) return "today"
  if (days === 1) return "tomorrow"
  return `in ${days}d`
}

function relativeTimestamp(iso: string): string {
  const t = new Date(iso).getTime()
  const now = Date.now()
  const mins = Math.round((now - t) / 60_000)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins}m ago`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.round(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Date(iso).toLocaleDateString()
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const today = new Date().toISOString().slice(0, 10)
  const sevenDaysAgo = new Date(Date.now() - 7 * 86_400_000).toISOString()

  // Five soonest reminders + activity in parallel.
  const [
    { data: reminders },
    { data: documents },
    { data: submissions },
    { data: companies },
  ] = await Promise.all([
    supabase
      .from("reminders")
      .select("id, company_id, title, due_date")
      .is("dismissed_at", null)
      .or(`snoozed_until.is.null,snoozed_until.lte.${today}`)
      .order("due_date", { ascending: true })
      .limit(5),
    supabase
      .from("documents")
      .select("id, company_id, document_type, file_name, created_at")
      .gte("created_at", sevenDaysAgo)
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("form_submissions")
      .select("id, company_id, form_code, status, updated_at, created_at")
      .gte("updated_at", sevenDaysAgo)
      .order("updated_at", { ascending: false })
      .limit(5),
    supabase.from("companies").select("id, name"),
  ])

  const reminderRows = (reminders ?? []) as Reminder[]
  const docRows = (documents ?? []) as Document[]
  const subRows = (submissions ?? []) as Submission[]
  const companyName = new Map(
    (companies ?? []).map((c) => [c.id, c.name as string]),
  )

  type ActivityRow = {
    key: string
    when: string
    icon: typeof FileText
    title: string
    subtitle: string
    href: string
  }
  const activity: ActivityRow[] = []
  for (const d of docRows) {
    activity.push({
      key: `doc-${d.id}`,
      when: d.created_at,
      icon: FileText,
      title: `Uploaded ${DOCUMENT_TYPE_LABELS[d.document_type] ?? d.file_name}`,
      subtitle: `${companyName.get(d.company_id) ?? "Unknown"} · ${relativeTimestamp(d.created_at)}`,
      href: `/companies/${d.company_id}`,
    })
  }
  for (const s of subRows) {
    const schema = getFormSchema(s.form_code)
    activity.push({
      key: `sub-${s.id}`,
      when: s.updated_at,
      icon: FileCheck,
      title: `${s.status === "completed" || s.status === "filed" ? "Filed" : "Drafted"} ${schema?.form_name ?? s.form_code}`,
      subtitle: `${companyName.get(s.company_id) ?? "Unknown"} · ${relativeTimestamp(s.updated_at)}`,
      href: "/submissions",
    })
  }
  activity.sort((a, b) => (a.when < b.when ? 1 : -1))

  const displayName = user?.email?.split("@")[0] ?? "there"
  const hour = new Date().getHours()
  const greet = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening"

  return (
    <div className="max-w-5xl mx-auto p-6 md:p-8 space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {greet}, {displayName}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Here&apos;s what&apos;s coming up and what&apos;s changed recently.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Widget
          icon={<Bell className="size-4" />}
          title="Upcoming reminders"
          href="/reminders"
          empty={
            reminderRows.length === 0
              ? "Nothing on the radar — upload a doc with an expiry date and reminders appear here."
              : null
          }
        >
          {reminderRows.map((r) => (
            <Link
              key={r.id}
              href="/reminders"
              className="flex items-center gap-3 px-3 py-2.5 hover:bg-secondary/40 transition-colors"
            >
              <CalendarClock className="size-4 text-muted-foreground shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-sm truncate">{r.title}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {companyName.get(r.company_id) ?? "Unknown"}
                </p>
              </div>
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                {relativeDays(r.due_date)}
              </span>
            </Link>
          ))}
        </Widget>

        <Widget
          icon={<Activity className="size-4" />}
          title="Recent activity"
          href="/submissions"
          empty={
            activity.length === 0
              ? "Nothing in the last 7 days. Upload a document or fill a form to get started."
              : null
          }
        >
          {activity.slice(0, 6).map((a) => {
            const Icon = a.icon
            return (
              <Link
                key={a.key}
                href={a.href}
                className="flex items-center gap-3 px-3 py-2.5 hover:bg-secondary/40 transition-colors"
              >
                <Icon className="size-4 text-muted-foreground shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm truncate">{a.title}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {a.subtitle}
                  </p>
                </div>
              </Link>
            )
          })}
        </Widget>
      </div>
    </div>
  )
}

function Widget({
  icon,
  title,
  href,
  empty,
  children,
}: {
  icon: React.ReactNode
  title: string
  href: string
  empty: string | null
  children: React.ReactNode
}) {
  return (
    <section className="border rounded-lg bg-card overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <h2 className="text-sm font-medium inline-flex items-center gap-2">
          <span className="text-muted-foreground">{icon}</span>
          {title}
        </h2>
        <Link
          href={href}
          className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-0.5"
        >
          See all <ChevronRight className="size-3" />
        </Link>
      </div>
      {empty ? (
        <p className="p-5 text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul className="divide-y divide-border">{children}</ul>
      )}
    </section>
  )
}
