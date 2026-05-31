import { BIR_2550M_SCHEMA } from "./bir-2550m"
import type { FormSchema } from "./types"

/** All form schemas Quill knows how to fill, keyed by form_code. */
export const FORM_SCHEMAS: Record<string, FormSchema> = {
  BIR_2550M: BIR_2550M_SCHEMA,
}

export function getFormSchema(form_code: string): FormSchema | null {
  return FORM_SCHEMAS[form_code] ?? null
}

export function listFillableFormCodes(): string[] {
  return Object.keys(FORM_SCHEMAS)
}
