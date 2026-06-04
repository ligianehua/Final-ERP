import { redirect } from "next/navigation"
import { createClient } from "@/lib/db/server"
import { isAdminEmail } from "@/lib/auth/admin"
import { AuditLogViewer } from "@/components/admin/audit-log-viewer"

export const dynamic = "force-dynamic"

// /admin/audit — list every recorded admin action on form templates.
// Server-rendered shell so non-admins get bounced off cleanly; the
// client component owns filtering + diff expansion.
export default async function AuditPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/login")
  if (!isAdminEmail(user.email)) redirect("/dashboard")

  const { data } = await supabase
    .from("audit_log")
    .select(
      "id, actor_id, actor_email, action, target_kind, target_id, before, after, at",
    )
    .order("at", { ascending: false })
    .limit(200)

  return (
    <div className="space-y-4 p-6 max-w-6xl">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Audit log</h1>
        <p className="text-sm text-muted-foreground">
          Every admin write to <code>form_templates</code> shows up
          here. Newest 200 events; use the filters to drill in.
        </p>
      </header>
      <AuditLogViewer initialEntries={data ?? []} />
    </div>
  )
}
