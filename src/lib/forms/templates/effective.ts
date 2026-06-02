import { createClient } from "@/lib/db/server"
import { getTemplateConfig } from "./index"
import type {
  CoordSpec,
  TemplateConfig,
  TemplateDimensions,
} from "../template-types"

type TemplateRow = {
  form_code: string
  pdf_storage_path: string | null
  png_storage_prefix: string | null
  dimensions: TemplateDimensions | null
  field_mapping: Record<string, CoordSpec> | null
}

/**
 * The active TemplateConfig for a form code. Priority order:
 *
 *   1. DB row with full data (user-uploaded template via /admin/templates/new)
 *   2. Code-side TemplateConfig (the hardcoded BIR_2550M_TEMPLATE etc.)
 *      with the DB's field_mapping merged on top if present
 *
 * code-side `transformValues` (functions don't round-trip through JSON)
 * survives the merge — DB-only templates simply don't have one.
 */
export async function getEffectiveTemplate(
  formCode: string,
): Promise<TemplateConfig | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from("form_templates")
    .select(
      "form_code, pdf_storage_path, png_storage_prefix, dimensions, field_mapping",
    )
    .eq("form_code", formCode)
    .maybeSingle()

  const row = data as TemplateRow | null
  const codeBase = getTemplateConfig(formCode)

  // DB-only template (no code base): synthesise the whole config.
  if (row?.pdf_storage_path && row.dimensions && row.field_mapping) {
    return {
      pdf_path: row.pdf_storage_path,
      storage_bucket: "templates",
      dimensions: row.dimensions,
      mapping: {
        strategy: "coordinates",
        fields: row.field_mapping,
      },
    }
  }

  // Falls back to code-side template + DB field_mapping override.
  if (!codeBase) return null
  if (!row?.field_mapping || codeBase.mapping.strategy !== "coordinates")
    return codeBase
  return {
    ...codeBase,
    mapping: {
      strategy: "coordinates",
      fields: row.field_mapping,
    },
  }
}

/**
 * Strip non-serialisable members so a TemplateConfig can be handed from
 * a Server Component down to a Client Component as a prop. Adds a
 * `page_image_prefix` URL the editor uses verbatim:
 *
 *   `${prefix}-1.png`, `${prefix}-2.png`, …
 *
 * — points at /public for code-side templates, at the templates Storage
 * bucket (public CDN URL) for DB-only ones.
 */
export type SerializableTemplateConfig = {
  pdf_path: string
  storage_bucket?: string
  dimensions: TemplateDimensions
  mapping: TemplateConfig["mapping"]
  page_image_prefix: string
}

export function serializeTemplate(
  formCode: string,
  template: TemplateConfig,
): SerializableTemplateConfig {
  return {
    pdf_path: template.pdf_path,
    storage_bucket: template.storage_bucket,
    dimensions: template.dimensions,
    mapping: template.mapping,
    page_image_prefix: pageImagePrefix(formCode, template),
  }
}

function pageImagePrefix(
  formCode: string,
  template: TemplateConfig,
): string {
  if (template.storage_bucket) {
    const base = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""
    // Save endpoint stores PNGs at `<form_code>/<form_code>-N.png`.
    return `${base}/storage/v1/object/public/${template.storage_bucket}/${formCode}/${formCode}`
  }
  // Code-side: pdf_path like "public/form-templates/BIR_2550M.pdf"
  // → URL prefix "/form-templates/BIR_2550M"
  return template.pdf_path.replace(/^public/, "").replace(/\.pdf$/i, "")
}
