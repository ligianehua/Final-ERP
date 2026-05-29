import { z } from "zod"
import { getAIClient, getDefaultModel } from "./client"
import { DOCUMENT_EXTRACTION_PROMPT_V1 } from "./prompts"
import { documentTypeSchema } from "@/lib/validations/document"

export const extractionResultSchema = z.object({
  document_type: documentTypeSchema.nullable(),
  document_number: z.string().nullable(),
  issued_date: z.string().nullable(),
  expiry_date: z.string().nullable(),
  issuing_authority: z.string().nullable(),
  subject_name: z.string().nullable(),
  tin: z.string().nullable(),
  sec_no: z.string().nullable(),
  dti_no: z.string().nullable(),
  sss_no: z.string().nullable(),
  philhealth_no: z.string().nullable(),
  pagibig_no: z.string().nullable(),
  address: z.string().nullable(),
  city: z.string().nullable(),
  phone: z.string().nullable(),
  email: z.string().nullable(),
  vat_status: z.enum(["vat_registered", "non_vat"]).nullable(),
})

export type ExtractionResult = z.infer<typeof extractionResultSchema>

/**
 * Send an image (as data URL) to the AI and extract structured fields.
 * Throws if the AI returns something un-parseable.
 */
export async function extractDocument(imageDataUrl: string): Promise<ExtractionResult> {
  const client = getAIClient()
  const model = getDefaultModel()

  const response = await client.chat.completions.create({
    model,
    temperature: 0,
    max_tokens: 1200,
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: DOCUMENT_EXTRACTION_PROMPT_V1 },
          { type: "image_url", image_url: { url: imageDataUrl } },
        ],
      },
    ],
  })

  const raw = response.choices[0]?.message?.content ?? ""

  // Log so we can debug what the model actually said. Visible in the
  // terminal running `next dev`.
  console.log("[AI extract] model:", model)
  console.log("[AI extract] raw response:\n" + raw)

  const json = extractJSON(raw)
  return extractionResultSchema.parse(json)
}

/** Pull a JSON object out of a possibly-wrapped response. */
function extractJSON(text: string): unknown {
  // Try a markdown code fence first
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
  const candidate = fenced ? fenced[1] : text
  // Then fall back to the first {...} block
  const braced = candidate.match(/\{[\s\S]*\}/)
  const jsonStr = braced ? braced[0] : candidate
  return JSON.parse(jsonStr)
}
