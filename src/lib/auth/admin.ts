/**
 * Allow-list of admin emails, read from the ADMIN_EMAILS env var.
 *
 *   ADMIN_EMAILS="alice@quill.dev, bob@quill.dev"
 *
 * Admins can save WYSIWYG layout edits back to the template as the new
 * default. Everyone else's edits stay scoped to their submission.
 */
function adminList(): string[] {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
}

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false
  return adminList().includes(email.toLowerCase())
}
