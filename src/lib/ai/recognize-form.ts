import { z } from "zod"
import { getAIClient, getDefaultModel } from "./client"
import { FORM_RECOGNITION_PROMPT_V1 } from "./prompts"

export const formCodeSchema = z.enum([
  "BIR_2550M",
  "MAYORS_PERMIT_RENEWAL",
  "BIR_0605",
  "SEC_GIS",
  "SSS_R3",
  "UNKNOWN",
])

export const agencySchema = z.enum(["BIR", "LGU", "SEC", "SSS", "UNKNOWN"])

export const recognitionResultSchema = z.object({
  form_code: formCodeSchema,
  form_name: z.string(),
  agency: agencySchema,
  confidence: z.number().min(0).max(1),
  reasoning: z.string(),
})

export type RecognitionResult = z.infer<typeof recognitionResultSchema>

/** Send a form image to the AI; get back which form it is + confidence. */
export async function recognizeForm(imageDataUrl: string): Promise<RecognitionResult> {
  const client = getAIClient()
  const model = getDefaultModel()

  const response = await client.chat.completions.create({
    model,
    temperature: 0,
    max_tokens: 600,
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: FORM_RECOGNITION_PROMPT_V1 },
          { type: "image_url", image_url: { url: imageDataUrl } },
        ],
      },
    ],
  })

  const raw = response.choices[0]?.message?.content ?? ""

  console.log("[AI recognize-form] model:", model)
  console.log("[AI recognize-form] raw response:\n" + raw)

  const json = extractJSON(raw)
  return recognitionResultSchema.parse(json)
}

function extractJSON(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
  const candidate = fenced ? fenced[1] : text
  const braced = candidate.match(/\{[\s\S]*\}/)
  return JSON.parse(braced ? braced[0] : candidate)
}
