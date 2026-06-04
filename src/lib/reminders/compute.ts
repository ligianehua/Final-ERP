import { SupabaseClient } from "@supabase/supabase-js"
import { DOCUMENT_TYPE_LABELS } from "@/lib/validations/document"

/**
 * Days BEFORE the actual expiry that we surface a reminder. Each lead
 * becomes its own reminder row (a one-shot ladder).
 */
export const LEAD_DAYS = [90, 30, 14, 7] as const

type DocumentRow = {
  id: string
  user_id: string
  company_id: string
  document_type: keyof typeof DOCUMENT_TYPE_LABELS
  document_number: string | null
  expiry_date: string | null
}

type ReminderInsert = {
  user_id: string
  company_id: string
  document_id: string
  reminder_type: "document_expiry"
  title: string
  due_date: string
  target_date: string
  source_key: string
}

/** UTC YYYY-MM-DD — Postgres stores `date` without timezone, no surprises. */
function dateString(d: Date): string {
  return d.toISOString().slice(0, 10)
}

/** Subtract a whole number of days from a YYYY-MM-DD string. */
function subDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() - days)
  return dateString(d)
}

function buildDocumentReminders(doc: DocumentRow): ReminderInsert[] {
  const expiry = doc.expiry_date
  if (!expiry) return []
  const docLabel = DOCUMENT_TYPE_LABELS[doc.document_type] ?? doc.document_type
  const numberSuffix = doc.document_number ? ` #${doc.document_number}` : ""
  return LEAD_DAYS.map<ReminderInsert>((lead) => ({
    user_id: doc.user_id,
    company_id: doc.company_id,
    document_id: doc.id,
    reminder_type: "document_expiry",
    title: `${docLabel}${numberSuffix} expires in ${lead} days`,
    due_date: subDays(expiry, lead),
    target_date: expiry,
    source_key: `doc:${doc.id}:t-${lead}`,
  }))
}

/**
 * Walk a single user's documents and ensure a reminder row exists at every
 * lead-day step before each expiry. Idempotent — the unique index on
 * (user_id, source_key) makes re-runs no-ops for unchanged data.
 *
 * Returns `{ created }`: how many rows the upsert actually touched.
 */
export async function computeRemindersForUser(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ created: number }> {
  const { data: docs, error: docsError } = await supabase
    .from("documents")
    .select("id, user_id, company_id, document_type, document_number, expiry_date")
    .eq("user_id", userId)
    .not("expiry_date", "is", null)

  if (docsError) throw new Error(docsError.message)
  if (!docs || docs.length === 0) return { created: 0 }

  const inserts: ReminderInsert[] = []
  for (const d of docs as DocumentRow[]) {
    inserts.push(...buildDocumentReminders(d))
  }

  if (inserts.length === 0) return { created: 0 }

  // Upsert by source_key — preserves snoozed_until / dismissed_at / email_sent_at
  // on rows the user has already touched.
  const { error: upsertError, count } = await supabase
    .from("reminders")
    .upsert(inserts, {
      onConflict: "user_id,source_key",
      ignoreDuplicates: true,
      count: "exact",
    })

  if (upsertError) throw new Error(upsertError.message)
  return { created: count ?? 0 }
}
