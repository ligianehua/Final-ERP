import type { TemplateConfig } from "../render-on-template"
import { BIR_2550M_TEMPLATE } from "./bir-2550m"

/**
 * PDF template configs Quill knows how to render onto, keyed by form_code.
 * Forms missing from this map fall back to the generic section-based
 * layout in `generate-pdf.ts`.
 */
const TEMPLATES: Record<string, TemplateConfig> = {
  BIR_2550M: BIR_2550M_TEMPLATE,
}

export function getTemplateConfig(form_code: string): TemplateConfig | null {
  return TEMPLATES[form_code] ?? null
}

export function listTemplatedForms(): string[] {
  return Object.keys(TEMPLATES)
}
