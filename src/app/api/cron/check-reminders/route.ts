import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/db/admin"
import { computeRemindersForUser } from "@/lib/reminders/compute"
import { sendReminderDigest } from "@/lib/email/send-reminder"

export const runtime = "nodejs"
export const maxDuration = 300

/**
 * Daily cron driver.
 *
 * 1. Walks every user's documents and (re)builds the reminder ladder.
 * 2. Finds reminders whose due_date has arrived and aren't already
 *    dismissed / snoozed / emailed.
 * 3. Sends one digest email per user covering everything pending,
 *    then stamps `email_sent_at` so we don't re-send the next day.
 *
 * Authenticated via the `CRON_SECRET` header — set the same value in
 * the platform cron config (Vercel cron, Supabase cron, etc.).
 */
export async function GET(request: Request) {
  return run(request)
}
export async function POST(request: Request) {
  return run(request)
}

async function run(request: Request) {
  // Vercel cron sends `Authorization: Bearer <CRON_SECRET>`; we also accept
  // a plain `x-cron-secret` header for other platforms (Supabase cron,
  // GitHub Actions, etc.).
  const secret = process.env.CRON_SECRET
  if (!secret) {
    return NextResponse.json(
      { error: "CRON_SECRET not configured" },
      { status: 500 },
    )
  }
  const auth = request.headers.get("authorization") ?? ""
  const fromHeader = request.headers.get("x-cron-secret") ?? ""
  if (auth !== `Bearer ${secret}` && fromHeader !== secret) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const admin = createAdminClient()
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://getquill.ai"

  const stats = {
    users_seen: 0,
    reminders_created: 0,
    emails_sent: 0,
    emails_skipped: 0,
    errors: [] as string[],
  }

  // 1) Enumerate users via the admin API.
  const { data: usersPage, error: usersError } =
    await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
  if (usersError) {
    return NextResponse.json({ error: usersError.message }, { status: 500 })
  }

  // Index companies once so the email digest can show company names.
  const { data: companies } = await admin.from("companies").select("id, name")
  const companyName = new Map(
    (companies ?? []).map((c) => [c.id, c.name as string]),
  )

  const today = new Date().toISOString().slice(0, 10)

  for (const user of usersPage.users) {
    stats.users_seen++
    try {
      // 2a) Refresh the user's reminder ladder.
      const { created } = await computeRemindersForUser(admin, user.id)
      stats.reminders_created += created

      // 2b) Pull due, un-emailed, un-dismissed, un-snoozed rows.
      const { data: due } = await admin
        .from("reminders")
        .select("id, company_id, title, due_date, target_date")
        .eq("user_id", user.id)
        .lte("due_date", today)
        .is("dismissed_at", null)
        .is("email_sent_at", null)
        .or(`snoozed_until.is.null,snoozed_until.lte.${today}`)
        .order("due_date", { ascending: true })

      if (!due || due.length === 0) {
        stats.emails_skipped++
        continue
      }
      if (!user.email) {
        stats.emails_skipped++
        continue
      }

      // 2c) Send and stamp.
      await sendReminderDigest({
        to: user.email,
        appUrl,
        reminders: due.map((r) => ({
          title: r.title,
          due_date: r.due_date,
          target_date: r.target_date,
          company_name: companyName.get(r.company_id) ?? "Unknown",
        })),
      })
      stats.emails_sent++

      await admin
        .from("reminders")
        .update({ email_sent_at: new Date().toISOString() })
        .in(
          "id",
          due.map((r) => r.id),
        )
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      stats.errors.push(`user ${user.id}: ${message}`)
    }
  }

  return NextResponse.json(stats)
}
