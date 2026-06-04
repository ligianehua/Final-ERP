import { getAIClient, getDefaultModel } from "./client"

export type FormFieldSpec = {
  id: string
  label: string
  semantic_type: string
}

export type ExtractedFieldValues = Record<string, string | null>

/**
 * Given a list of fields and an image, ask the model to read whatever
 * values are visible for each field. Returns a flat map from field id
 * to extracted string (or null when not legible). The caller decides
 * which subset to merge into their form state.
 *
 * No fixed JSON schema — we just instruct the model to use the field
 * ids as keys. Unknown keys in the response are ignored.
 */
export async function extractFormFields(
  imageDataUrl: string,
  fields: FormFieldSpec[],
): Promise<ExtractedFieldValues> {
  if (fields.length === 0) return {}

  const fieldList = fields
    .map(
      (f) =>
        `  "${f.id}": ${describeForType(f.semantic_type)},  // ${f.label}`,
    )
    .join("\n")

  const prompt = `You are reading a scanned or photographed document so a user can pre-fill an electronic form. Extract VALUES for each field listed below. Return JSON with EXACTLY these keys; use null whenever a value is not visible or you're not confident. NEVER invent.

{
${fieldList}
}

Rules:
- Output ONLY the JSON object. No prose, no markdown fences.
- Dates use ISO format YYYY-MM-DD when present.
- TINs keep their dashes: "XXX-XXX-XXX-XXX".
- Amounts are plain decimal strings without commas or currency: "1250000.00".
- Period months use two digits: "01"–"12". Years are four digits.
- vat_status is "vat_registered" or "non_vat" exactly.
- If the document looks unrelated to these fields (a totally different form), set every key to null.`

  const client = getAIClient()
  const model = getDefaultModel()
  const response = await client.chat.completions.create({
    model,
    temperature: 0,
    max_tokens: 1500,
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: prompt },
          { type: "image_url", image_url: { url: imageDataUrl } },
        ],
      },
    ],
  })

  const raw = response.choices[0]?.message?.content ?? ""
  console.log("[AI extract-form-fields] raw:\n" + raw)

  let json: unknown
  try {
    json = extractJSON(raw)
  } catch {
    return {}
  }
  if (typeof json !== "object" || json === null) return {}

  // Only keep keys we asked for, only string-or-null values.
  const allowed = new Set(fields.map((f) => f.id))
  const out: ExtractedFieldValues = {}
  for (const [k, v] of Object.entries(json as Record<string, unknown>)) {
    if (!allowed.has(k)) continue
    if (v === null) {
      out[k] = null
    } else if (typeof v === "string") {
      const trimmed = v.trim()
      out[k] = trimmed === "" ? null : trimmed
    } else if (typeof v === "number") {
      out[k] = String(v)
    }
  }
  return out
}

function describeForType(semanticType: string): string {
  switch (semanticType) {
    case "company_tin":
    case "signatory_tin":
      return `"XXX-XXX-XXX-XXX" | null`
    case "company_name":
    case "signatory_name":
    case "signatory_position":
    case "company_address":
    case "company_city":
      return `string | null`
    case "company_phone":
      return `string | null`
    case "company_email":
      return `string | null`
    case "company_vat_status":
      return `"vat_registered" | "non_vat" | null`
    case "period_month":
      return `"01"..."12" | null`
    case "period_year":
      return `"YYYY" | null`
    case "amount":
      return `string-decimal | null`
    case "company_sec_no":
    case "company_dti_no":
      return `string | null`
    default:
      return `string | null`
  }
}

function extractJSON(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
  const candidate = fenced ? fenced[1] : text
  const braced = candidate.match(/\{[\s\S]*\}/)
  return JSON.parse(braced ? braced[0] : candidate)
}
