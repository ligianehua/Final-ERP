import { NextResponse } from "next/server"
import { createClient } from "@/lib/db/server"
import { computeRemindersForUser } from "@/lib/reminders/compute"

// POST /api/reminders/recompute
// Walks the user's documents and (re)materialises any missing reminder
// rows. Existing rows (with the user's snooze / dismiss state) are
// preserved. Returns how many fresh rows were created.
export async function POST() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const result = await computeRemindersForUser(supabase, user.id)
    return NextResponse.json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : "Compute failed"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
