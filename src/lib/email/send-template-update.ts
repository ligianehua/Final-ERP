import type { SourceCheck } from "@/lib/templates/check-source"

const RESEND_ENDPOINT = "https://api.resend.com/emails"

/**
 * Notify admins when one or more government template sources have
 * changed. Failures and unchanged rows are summarised at the bottom so
 * the digest also doubles as a "did the cron run" health check.
 */
export async function sendTemplateUpdateDigest({
  to,
  appUrl,
  results,
}: {
  to: string[]
  appUrl: string
  results: SourceCheck[]
}): Promise<string> {
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.RESEND_FROM_EMAIL
  if (!apiKey || !from) {
    throw new Error("RESEND_API_KEY and RESEND_FROM_EMAIL must be set")
  }
  if (to.length === 0) return ""

  const changed = results.filter((r) => r.status === "changed")
  const failed = results.filter((r) => r.status === "fetch_failed")
  const unchanged = results.filter((r) => r.status === "unchanged")
  const skipped = results.filter((r) => r.status === "skipped")

  // Only send when something interesting happened. Bare "all unchanged"
  // digests would just train recipients to ignore the inbox.
  if (changed.length === 0 && failed.length === 0) return ""

  const subject =
    changed.length > 0
      ? `Quill: ${changed.length} government form${changed.length === 1 ? "" : "s"} updated`
      : `Quill: template watcher couldn't reach ${failed.length} source${failed.length === 1 ? "" : "s"}`

  const link = `${appUrl.replace(/\/$/, "")}/forms`

  const res = await fetch(RESEND_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to,
      subject,
      html: renderHTML({ changed, failed, unchanged, skipped, link }),
      text: renderText({ changed, failed, unchanged, skipped, link }),
    }),
  })

  if (!res.ok) {
    const body = await res.text().catch(() => "")
    throw new Error(`Resend API ${res.status}: ${body}`)
  }
  const json = (await res.json()) as { id?: string }
  return json.id ?? ""
}

function renderText({
  changed,
  failed,
  unchanged,
  skipped,
  link,
}: {
  changed: SourceCheck[]
  failed: SourceCheck[]
  unchanged: SourceCheck[]
  skipped: SourceCheck[]
  link: string
}): string {
  const lines = ["Template watcher report", ""]

  if (changed.length > 0) {
    lines.push("CHANGED — please re-bake these templates:")
    for (const r of changed) {
      if (r.status !== "changed") continue
      lines.push(`  • ${r.form_code} (${r.form_name})`)
      lines.push(`    new hash: ${r.new_hash.slice(0, 12)}…`)
    }
    lines.push("")
  }
  if (failed.length > 0) {
    lines.push("FAILED — couldn't fetch:")
    for (const r of failed) {
      if (r.status !== "fetch_failed") continue
      lines.push(`  • ${r.form_code}: ${r.reason}`)
    }
    lines.push("")
  }
  if (unchanged.length > 0) {
    lines.push(`Unchanged: ${unchanged.map((r) => r.form_code).join(", ")}`)
  }
  if (skipped.length > 0) {
    lines.push(`Skipped: ${skipped.map((r) => r.form_code).join(", ")}`)
  }
  lines.push("")
  lines.push(`Open Quill: ${link}`)
  return lines.join("\n")
}

function renderHTML(args: {
  changed: SourceCheck[]
  failed: SourceCheck[]
  unchanged: SourceCheck[]
  skipped: SourceCheck[]
  link: string
}): string {
  const changedRows = args.changed
    .filter((r): r is Extract<SourceCheck, { status: "changed" }> => r.status === "changed")
    .map(
      (r) => `
      <tr>
        <td style="padding:12px 16px;border-bottom:1px solid #fee2e2;background:#fef2f2;">
          <div style="font-size:14px;color:#991b1b;font-weight:600;">${r.form_code}</div>
          <div style="font-size:12px;color:#7f1d1d;margin-top:2px;">${r.form_name}</div>
          <div style="font-size:11px;color:#a3a3a3;margin-top:6px;font-family:ui-monospace,Menlo,monospace;">
            ${r.previous_hash ? r.previous_hash.slice(0, 12) : "(no prior)"} → ${r.new_hash.slice(0, 12)} · ${r.bytes} B
          </div>
        </td>
      </tr>`,
    )
    .join("")

  const failedRows = args.failed
    .filter((r): r is Extract<SourceCheck, { status: "fetch_failed" }> => r.status === "fetch_failed")
    .map(
      (r) => `
      <tr>
        <td style="padding:10px 16px;border-bottom:1px solid #fef3c7;background:#fffbeb;">
          <div style="font-size:13px;color:#92400e;">${r.form_code} · ${r.form_name}</div>
          <div style="font-size:11px;color:#a16207;margin-top:2px;">${r.reason}</div>
        </td>
      </tr>`,
    )
    .join("")

  const unchangedLine =
    args.unchanged.length > 0
      ? `<div style="padding:12px 16px;font-size:12px;color:#64748b;">Unchanged: ${args.unchanged.map((r) => r.form_code).join(", ")}</div>`
      : ""

  return `
<!doctype html>
<html><body style="margin:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
  <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#f8fafc;padding:32px 0;">
    <tr><td align="center">
      <table cellpadding="0" cellspacing="0" border="0" width="560" style="background:#ffffff;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
        <tr><td style="padding:20px 24px 12px;border-bottom:1px solid #e5e7eb;">
          <div style="font-size:18px;font-weight:600;color:#0f172a;">Template watcher</div>
          <div style="font-size:12px;color:#64748b;margin-top:2px;">Daily check of government form sources</div>
        </td></tr>
        ${changedRows ? `<tr><td><table cellpadding="0" cellspacing="0" width="100%">${changedRows}</table></td></tr>` : ""}
        ${failedRows ? `<tr><td><table cellpadding="0" cellspacing="0" width="100%">${failedRows}</table></td></tr>` : ""}
        ${unchangedLine ? `<tr><td>${unchangedLine}</td></tr>` : ""}
        <tr><td style="padding:20px 24px;border-top:1px solid #e5e7eb;">
          <a href="${args.link}" style="display:inline-block;background:#0f172a;color:#ffffff;padding:9px 16px;border-radius:6px;font-size:13px;text-decoration:none;">Open Quill</a>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`
}
