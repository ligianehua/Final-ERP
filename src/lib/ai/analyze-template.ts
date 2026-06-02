import { z } from "zod"
import { getAIClient, getDefaultModel } from "./client"
import { TEMPLATE_ANALYSIS_PROMPT_V1 } from "./prompts"

const semanticTypeSchema = z.enum([
  "company_name",
  "company_tin",
  "company_sec_no",
  "company_dti_no",
  "company_address",
  "company_city",
  "company_phone",
  "company_email",
  "company_vat_status",
  "period_month",
  "period_year",
  "amount",
  "signatory_name",
  "signatory_tin",
  "signatory_position",
  "text",
])

export const templateAnalysisSchema = z.object({
  issuer: z.object({
    name: z.string(),
    type: z.enum(["government", "bank", "lgu", "other"]),
    abbreviation: z.string().nullable(),
  }),
  form_name: z.string(),
  form_code_suggested: z.string().regex(/^[A-Z0-9_]+$/),
  fields: z.array(
    z.object({
      label: z.string(),
      semantic_type: semanticTypeSchema,
      data_source: z.string().nullable(),
      required: z.boolean(),
      approximate_position: z
        .object({
          x_pct: z.number().min(0).max(1),
          y_pct: z.number().min(0).max(1),
          width_pct: z.number().min(0).max(1),
          height_pct: z.number().min(0).max(1),
        })
        .nullable(),
      notes: z.string().nullable(),
    }),
  ),
  confidence: z.number().min(0).max(1),
  reasoning: z.string(),
})

export type TemplateAnalysis = z.infer<typeof templateAnalysisSchema>

export async function analyzeTemplate(
  imageDataUrl: string,
): Promise<TemplateAnalysis> {
  const client = getAIClient()
  const model = getDefaultModel()
  const response = await client.chat.completions.create({
    model,
    temperature: 0,
    max_tokens: 4000,
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: TEMPLATE_ANALYSIS_PROMPT_V1 },
          { type: "image_url", image_url: { url: imageDataUrl } },
        ],
      },
    ],
  })
  const raw = response.choices[0]?.message?.content ?? ""
  console.log("[AI analyze-template] raw:\n" + raw)
  return templateAnalysisSchema.parse(extractJSON(raw))
}

function extractJSON(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
  const candidate = fenced ? fenced[1] : text
  const braced = candidate.match(/\{[\s\S]*\}/)
  return JSON.parse(braced ? braced[0] : candidate)
}
