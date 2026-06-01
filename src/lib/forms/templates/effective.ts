import { createClient } from "@/lib/db/server"
import { getTemplateConfig } from "./index"
import type { CoordSpec, TemplateConfig } from "../template-types"

/**
 * The active TemplateConfig for a form code, with any admin-saved field
 * mapping from the DB layered on top of the code-side default.
 *
 * Keeps the code-side `transformValues` callback (functions don't
 * round-trip through JSON); DB only owns the coordinate map.
 */
export async function getEffectiveTemplate(
  formCode: string,
): Promise<TemplateConfig | null> {
  const base = getTemplateConfig(formCode)
  if (!base) return null

  const supabase = await createClient()
  const { data } = await supabase
    .from("form_templates")
    .select("field_mapping")
    .eq("form_code", formCode)
    .maybeSingle()

  if (!data?.field_mapping) return base
  if (base.mapping.strategy !== "coordinates") return base

  return {
    ...base,
    mapping: {
      strategy: "coordinates",
      fields: data.field_mapping as Record<string, CoordSpec>,
    },
  }
}

/**
 * Strip non-serialisable members so a TemplateConfig can be handed
 * from a Server Component down to a Client Component as a prop.
 */
export type SerializableTemplateConfig = Omit<
  TemplateConfig,
  "transformValues"
>

export function serializeTemplate(
  t: TemplateConfig,
): SerializableTemplateConfig {
  return {
    pdf_path: t.pdf_path,
    dimensions: t.dimensions,
    mapping: t.mapping,
  }
}
