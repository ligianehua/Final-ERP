import { createClient } from "@/lib/db/server"
import { getFormSchema } from "./registry"
import type { FormSchema } from "./types"

/**
 * The active FormSchema for a form_code. Same priority chain as
 * `getEffectiveTemplate`:
 *   1. Code-side hardcoded schema (BIR_2550M_SCHEMA etc.)
 *   2. DB row's `field_schema` JSON for admin-uploaded templates
 *
 * Returns null if neither knows about the form_code.
 */
export async function getEffectiveFormSchema(
  formCode: string,
): Promise<FormSchema | null> {
  const codeBase = getFormSchema(formCode)
  if (codeBase) return codeBase

  const supabase = await createClient()
  const { data } = await supabase
    .from("form_templates")
    .select("field_schema")
    .eq("form_code", formCode)
    .maybeSingle()

  if (data?.field_schema) return data.field_schema as FormSchema
  return null
}
