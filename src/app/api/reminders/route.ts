import { NextResponse } from "next/server"
import { createClient } from "@/lib/db/server"

// GET /api/reminders?company_id=...
// Returns active (not dismissed, snooze elapsed) reminders for the current
// user, ordered by due_date ascending.
export async function GET(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const url = new URL(request.url)
  const companyId = url.searchParams.get("company_id")

  const today = new Date().toISOString().slice(0, 10)
  let query = supabase
    .from("reminders")
    .select("*")
    .is("dismissed_at", null)
    .or(`snoozed_until.is.null,snoozed_until.lte.${today}`)
    .order("due_date", { ascending: true })

  if (companyId) query = query.eq("company_id", companyId)

  const { data, error } = await query
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ reminders: data })
}
