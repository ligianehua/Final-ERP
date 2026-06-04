type ReminderLine = {
  title: string
  due_date: string
  target_date: string | null
  company_name: string
}

const RESEND_ENDPOINT = "https://api.resend.com/emails"

/**
 * Send one digest email summarising every reminder due now for a user.
 * Returns the Resend message id on success; throws on failure.
 *
 * We hit the REST endpoint directly so we don't pull in another npm
 * dependency just for one POST.
 */
export async function sendReminderDigest({
  to,
  reminders,
  appUrl,
}: {
  to: string
  reminders: ReminderLine[]
  appUrl: string
}): Promise<string> {
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.RESEND_FROM_EMAIL
  if (!apiKey || !from) {
    throw new Error("RESEND_API_KEY and RESEND_FROM_EMAIL must be set")
  }
  if (reminders.length === 0) return ""

  const subject = `Quill: ${reminders.length} reminder${reminders.length === 1 ? "" : "s"} need${reminders.length === 1 ? "s" : ""} your attention`
  const remindersLink = `${appUrl.replace(/\/$/, "")}/reminders`

  const res = await fetch(RESEND_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject,
      html: renderHTML({ reminders, remindersLink }),
      text: renderText({ reminders, remindersLink }),
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
  reminders,
  remindersLink,
}: {
  reminders: ReminderLine[]
  remindersLink: string
}): string {
  const lines = reminders.map(
    (r) =>
      `• ${r.title} (${r.company_name})${r.target_date ? ` — expires ${r.target_date}` : ""}`,
  )
  return [
    "Hello from Quill —",
    "",
    "Here are the items that need your attention today:",
    "",
    ...lines,
    "",
    `Open the full list: ${remindersLink}`,
    "",
    "— Quill",
  ].join("\n")
}

function renderHTML({
  reminders,
  remindersLink,
}: {
  reminders: ReminderLine[]
  remindersLink: string
}): string {
  const items = reminders
    .map(
      (r) => `
        <tr>
          <td style="padding:12px 16px;border-bottom:1px solid #e5e7eb;">
            <div style="font-size:14px;color:#0f172a;font-weight:500;">${escapeHtml(r.title)}</div>
            <div style="font-size:12px;color:#64748b;margin-top:2px;">
              ${escapeHtml(r.company_name)}${r.target_date ? ` · Expires ${escapeHtml(r.target_date)}` : ""}
            </div>
          </td>
        </tr>`,
    )
    .join("")

  return `
<!doctype html>
<html>
  <body style="margin:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#f8fafc;padding:32px 0;">
      <tr><td align="center">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="560" style="background:#ffffff;border:1px solid #e5e7eb;border-radius:8px;">
          <tr>
            <td style="padding:24px 24px 8px;">
              <div style="font-size:20px;font-weight:600;color:#0f172a;">Quill reminders</div>
              <div style="font-size:13px;color:#64748b;margin-top:4px;">
                ${reminders.length} item${reminders.length === 1 ? "" : "s"} due now
              </div>
            </td>
          </tr>
          <tr>
            <td>
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                ${items}
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 24px;">
              <a href="${remindersLink}" style="display:inline-block;background:#0f172a;color:#ffffff;padding:9px 16px;border-radius:6px;font-size:13px;text-decoration:none;">Open Quill</a>
            </td>
          </tr>
        </table>
        <div style="font-size:11px;color:#94a3b8;margin-top:16px;">
          Sent by Quill · The AI permit advisor for Philippine SMEs.
        </div>
      </td></tr>
    </table>
  </body>
</html>`
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
}
