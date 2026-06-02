import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/db/admin"
import {
  checkTemplateSources,
  type TrackedTemplate,
} from "@/lib/templates/check-source"
import { sendTemplateUpdateDigest } from "@/lib/email/send-template-update"

export const runtime = "nodejs"
export const maxDuration = 300

/**
 * Weekly-ish cron: poll every form_templates.source_url, hash the
 * response, and email admins when the hash moves. NEVER auto-replaces
 * the template — a human has to verify the new file before swapping it
 * in (the cron just sends a "go look").
 *
 * Auth: `Authorization: Bearer $CRON_SECRET` (Vercel format) or
 * `x-cron-secret: $CRON_SECRET`.
 */
export async function GET(request: Request) {
  return run(request)
}
export async function POST(request: Request) {
  return run(request)
}

async function run(request: Request) {
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

  const { data: rows, error } = await admin
    .from("form_templates")
    .select("form_code, form_name, source_url, source_hash")
    .eq("is_active", true)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const results = await checkTemplateSources(
    admin,
    (rows ?? []) as TrackedTemplate[],
  )

  // Send the digest to every admin email — but only if something
  // changed or failed (sendTemplateUpdateDigest no-ops on "all unchanged").
  const adminEmails = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)

  let emailId: string | null = null
  let emailError: string | null = null
  if (adminEmails.length > 0) {
    try {
      emailId = await sendTemplateUpdateDigest({
        to: adminEmails,
        appUrl,
        results,
      })
    } catch (err) {
      emailError = err instanceof Error ? err.message : String(err)
    }
  }

  return NextResponse.json({
    results,
    email_id: emailId,
    email_error: emailError,
  })
}
