import type { Company, CompanyPerson } from "@/types"
import type { FilledField, FormField, FormSchema } from "./types"

/** Pick a default signatory: prefer officer, then owner, then any. */
export function pickDefaultSignatory(people: CompanyPerson[]): CompanyPerson | null {
  if (people.length === 0) return null
  const officer = people.find((p) => p.role === "officer")
  if (officer) return officer
  const owner = people.find((p) => p.role === "owner")
  if (owner) return owner
  return people[0]
}

/**
 * Resolve a field's value by looking up its data_source on the company
 * or the chosen signatory. Returns null if no source or no value.
 */
function resolveValue(
  field: FormField,
  company: Company,
  signatory: CompanyPerson | null
): { value: string | null; source: string | null } {
  if (!field.data_source) return { value: null, source: null }

  if (field.data_source.startsWith("company.")) {
    const key = field.data_source.slice("company.".length) as keyof Company
    const raw = company[key]
    return { value: raw == null ? null : String(raw), source: field.data_source }
  }

  if (field.data_source.startsWith("person.")) {
    if (!signatory) return { value: null, source: field.data_source }
    const key = field.data_source.slice("person.".length) as keyof CompanyPerson
    const raw = signatory[key]
    return { value: raw == null ? null : String(raw), source: field.data_source }
  }

  return { value: null, source: null }
}

/** Build the full filled-field set for a given schema and archive snapshot. */
export function fillFromArchive(
  schema: FormSchema,
  company: Company,
  people: CompanyPerson[],
  signatoryId?: string | null
): { fields: FilledField[]; signatory: CompanyPerson | null } {
  const signatory =
    signatoryId
      ? people.find((p) => p.id === signatoryId) ?? null
      : pickDefaultSignatory(people)

  const fields: FilledField[] = schema.fields.map((f) => {
    const { value, source } = resolveValue(f, company, signatory)
    return {
      id: f.id,
      label: f.label,
      value,
      source,
      // Direct lookup is 1.0 when we found a value, 0 when we didn't.
      // Confidence becomes meaningful later if AI suggests values.
      confidence: value ? 1 : 0,
      period_specific: f.period_specific,
      required: f.required,
      hint: f.hint,
    }
  })

  return { fields, signatory }
}
