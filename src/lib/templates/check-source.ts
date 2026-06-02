import { createHash } from "node:crypto"
import { SupabaseClient } from "@supabase/supabase-js"

/**
 * One row's worth of source-tracking input.
 */
export type TrackedTemplate = {
  form_code: string
  form_name: string
  source_url: string | null
  source_hash: string | null
}

export type SourceCheck =
  | { form_code: string; form_name: string; status: "skipped"; reason: string }
  | { form_code: string; form_name: string; status: "fetch_failed"; reason: string }
  | { form_code: string; form_name: string; status: "unchanged"; hash: string }
  | {
      form_code: string
      form_name: string
      status: "changed"
      previous_hash: string | null
      new_hash: string
      bytes: number
    }

/**
 * Hash the live content at every form template's `source_url`, compare
 * with what's stored, and stamp the row with both `last_checked_at` and
 * (if the hash moved) `last_changed_at`. Returns a per-form summary the
 * caller can email or log.
 *
 * We hash the raw bytes — works whether the URL serves a PDF, an HTML
 * page listing the latest version, or a redirect target. Gov.ph sites
 * tend to fingerprint with timestamps so spurious diffs are possible;
 * the email digest leaves it to the admin to verify before replacing.
 */
export async function checkTemplateSources(
  supabase: SupabaseClient,
  templates: TrackedTemplate[],
): Promise<SourceCheck[]> {
  const now = new Date().toISOString()
  const results: SourceCheck[] = []

  for (const t of templates) {
    if (!t.source_url) {
      results.push({
        form_code: t.form_code,
        form_name: t.form_name,
        status: "skipped",
        reason: "no source_url",
      })
      continue
    }

    let bytes: ArrayBuffer
    try {
      const res = await fetch(t.source_url, {
        // Identify the bot honestly so gov.ph IT can whitelist if needed.
        headers: {
          "User-Agent":
            "QuillTemplateWatcher/1.0 (+https://getquill.ai/about/bots)",
          Accept: "*/*",
        },
        redirect: "follow",
      })
      if (!res.ok) {
        results.push({
          form_code: t.form_code,
          form_name: t.form_name,
          status: "fetch_failed",
          reason: `HTTP ${res.status}`,
        })
        await supabase
          .from("form_templates")
          .update({ last_checked_at: now })
          .eq("form_code", t.form_code)
        continue
      }
      bytes = await res.arrayBuffer()
    } catch (err) {
      results.push({
        form_code: t.form_code,
        form_name: t.form_name,
        status: "fetch_failed",
        reason: err instanceof Error ? err.message : String(err),
      })
      continue
    }

    const hash = createHash("sha256")
      .update(new Uint8Array(bytes))
      .digest("hex")

    if (t.source_hash === hash) {
      await supabase
        .from("form_templates")
        .update({ last_checked_at: now })
        .eq("form_code", t.form_code)
      results.push({
        form_code: t.form_code,
        form_name: t.form_name,
        status: "unchanged",
        hash,
      })
      continue
    }

    await supabase
      .from("form_templates")
      .update({
        source_hash: hash,
        last_checked_at: now,
        last_changed_at: now,
      })
      .eq("form_code", t.form_code)

    results.push({
      form_code: t.form_code,
      form_name: t.form_name,
      status: "changed",
      previous_hash: t.source_hash,
      new_hash: hash,
      bytes: bytes.byteLength,
    })
  }

  return results
}
