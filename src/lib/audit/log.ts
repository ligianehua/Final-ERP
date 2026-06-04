import type { SupabaseClient } from "@supabase/supabase-js"

export type AuditAction =
  | "template.update_metadata"
  | "template.update_schema"
  | "template.update_field_mapping"
  | "template.update_field"
  | "template.replace_pdf"
  | "template.delete"
  | "template.lock_takeover"

export type AuditEntry = {
  actor: { id: string; email: string | null }
  action: AuditAction
  target: { kind: "form_template" | "form_template_field"; id: string }
  before?: unknown
  after?: unknown
}

/**
 * Best-effort audit write. Never throws — admin edits should not be
 * gated on the audit log being writable. The DB index on (target_kind,
 * target_id, at desc) backs the /admin/audit viewer.
 */
export async function logAudit(
  supabase: SupabaseClient,
  entry: AuditEntry,
): Promise<void> {
  try {
    await supabase.from("audit_log").insert({
      actor_id: entry.actor.id,
      actor_email: entry.actor.email,
      action: entry.action,
      target_kind: entry.target.kind,
      target_id: entry.target.id,
      before: entry.before ?? null,
      after: entry.after ?? null,
    })
  } catch {
    // Swallow — never fail the parent request on audit failure.
  }
}
