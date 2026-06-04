import { z } from "zod"
import { getAIClient, getDefaultModel } from "./client"
import {
  VAT_RECEIPT_EXTRACTION_PROMPT_V1,
  VAT_SUMMARY_EXTRACTION_PROMPT_V1,
} from "./prompts"

export const vatSummarySchema = z.object({
  gross_sales: z.string().nullable(),
  output_tax: z.string().nullable(),
  input_tax: z.string().nullable(),
  vat_payable: z.string().nullable(),
  period: z.string().nullable(),
  confidence: z.number().min(0).max(1),
  reasoning: z.string(),
})

export type VATSummaryExtraction = z.infer<typeof vatSummarySchema>

export const vatReceiptSchema = z.object({
  vendor_name: z.string().nullable(),
  vendor_tin: z.string().nullable(),
  date: z.string().nullable(),
  vatable_amount: z.string().nullable(),
  vat_amount: z.string().nullable(),
  total_amount: z.string().nullable(),
  confidence: z.number().min(0).max(1),
})

export type VATReceiptExtraction = z.infer<typeof vatReceiptSchema>

export async function extractVATSummary(
  imageDataUrl: string,
): Promise<VATSummaryExtraction> {
  const raw = await callAI(VAT_SUMMARY_EXTRACTION_PROMPT_V1, imageDataUrl)
  console.log("[AI vat-summary] raw:\n" + raw)
  return vatSummarySchema.parse(extractJSON(raw))
}

export async function extractVATReceipt(
  imageDataUrl: string,
): Promise<VATReceiptExtraction> {
  const raw = await callAI(VAT_RECEIPT_EXTRACTION_PROMPT_V1, imageDataUrl)
  console.log("[AI vat-receipt] raw:\n" + raw)
  return vatReceiptSchema.parse(extractJSON(raw))
}

async function callAI(prompt: string, imageDataUrl: string): Promise<string> {
  const client = getAIClient()
  const model = getDefaultModel()
  const response = await client.chat.completions.create({
    model,
    temperature: 0,
    max_tokens: 1000,
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
  return response.choices[0]?.message?.content ?? ""
}

/** Pull a JSON object out of a possibly-wrapped response. */
function extractJSON(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
  const candidate = fenced ? fenced[1] : text
  const braced = candidate.match(/\{[\s\S]*\}/)
  const jsonStr = braced ? braced[0] : candidate
  return JSON.parse(jsonStr)
}
