/**
 * Field-schema model for a fillable government form.
 *
 * A FormSchema describes which fields a form has, how each one is filled
 * from the user's archive, and whether the value changes every period.
 */

export type SemanticType =
  // Identity (from companies row)
  | "company_name"
  | "company_tin"
  | "company_sec_no"
  | "company_dti_no"
  | "company_address"
  | "company_city"
  | "company_phone"
  | "company_email"
  | "company_vat_status"
  // Period (user picks each filing)
  | "period_month"
  | "period_year"
  // Free numeric (period-specific computations the user enters)
  | "amount"
  // People (from company_people)
  | "signatory_name"
  | "signatory_tin"
  | "signatory_position"
  // Free text / catch-all
  | "text"

export type FormField = {
  /** Stable identifier (used as key in field_values jsonb). */
  id: string
  /** Display label shown to the user. */
  label: string
  /** What this field represents semantically. */
  semantic_type: SemanticType
  /** Path into archive for direct lookup, e.g. "company.tin". null means no auto-source. */
  data_source: string | null
  /** Must be filled before the form can be marked completed. */
  required: boolean
  /** Value changes every filing (period-specific) — never reused. */
  period_specific: boolean
  /** Short example shown inside the empty input (e.g. "YYYY"). */
  placeholder?: string
  /** Longer explanation shown below the input. */
  hint?: string
}

export type FormSchema = {
  form_code: string
  form_name: string
  agency: string
  fields: FormField[]
}

/** What the /api/forms/fill API returns per field. */
export type FilledField = {
  id: string
  label: string
  semantic_type: SemanticType
  value: string | null
  source: string | null
  confidence: number
  period_specific: boolean
  required: boolean
  placeholder?: string
  hint?: string
}
