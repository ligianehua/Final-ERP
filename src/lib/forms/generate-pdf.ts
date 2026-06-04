import {
  PDFDocument,
  PDFFont,
  PDFPage,
  StandardFonts,
  rgb,
} from "pdf-lib"
import { renderOnTemplate } from "./render-on-template"
import { getEffectiveTemplate } from "./templates/effective"
import type { FieldOverrides } from "./template-types"
import type { FormSchema } from "./types"

/**
 * Group fields visually on the PDF. For each supported form, define which
 * fields belong to which section (in order).
 */
type Section = { title: string; fieldIds: string[] }

const FORM_SECTIONS: Record<string, Section[]> = {
  BIR_2550M: [
    { title: "Period", fieldIds: ["period_month", "period_year"] },
    {
      title: "Taxpayer Information",
      fieldIds: [
        "tin",
        "rdo_code",
        "registered_name",
        "trade_name",
        "line_of_business",
        "registered_address",
        "city",
        "telephone",
        "email",
        "vat_status",
      ],
    },
    {
      title: "Authorized Signatory",
      fieldIds: ["signatory_name", "signatory_position", "signatory_tin"],
    },
    {
      title: "Tax Computation",
      fieldIds: ["gross_sales", "output_tax", "input_tax", "vat_payable"],
    },
  ],
}

/** A4 in points */
const A4 = { width: 595.28, height: 841.89 }
const MARGIN = 50
const CONTENT_WIDTH = A4.width - MARGIN * 2

/**
 * Helvetica only supports Latin-1; replace glyphs that would render as a
 * blank box. The Philippine peso sign isn't in Helvetica's coverage.
 */
function sanitize(text: string): string {
  return text
    .replace(/₱/g, "PHP ")
    .replace(/[—–]/g, "-")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
}

function formatValue(semantic_type: string, value: string | null): string {
  if (!value) return "—"
  if (semantic_type === "company_vat_status") {
    if (value === "vat_registered") return "VAT Registered"
    if (value === "non_vat") return "Non-VAT"
  }
  if (semantic_type === "amount") {
    const num = Number(value)
    if (!isNaN(num)) {
      return num.toLocaleString("en-PH", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    }
  }
  return value
}

function wrapLines(
  text: string,
  font: PDFFont,
  size: number,
  maxWidth: number
): string[] {
  const words = text.split(/\s+/)
  const lines: string[] = []
  let current = ""
  for (const word of words) {
    const test = current ? `${current} ${word}` : word
    if (font.widthOfTextAtSize(test, size) <= maxWidth) {
      current = test
    } else {
      if (current) lines.push(current)
      current = word
    }
  }
  if (current) lines.push(current)
  return lines.length > 0 ? lines : [""]
}

type Ctx = {
  pdf: PDFDocument
  page: PDFPage
  font: PDFFont
  fontBold: PDFFont
  y: number
}

function newPage(ctx: Ctx) {
  ctx.page = ctx.pdf.addPage([A4.width, A4.height])
  ctx.y = A4.height - MARGIN
}

function ensureSpace(ctx: Ctx, needed: number) {
  if (ctx.y - needed < MARGIN + 40) newPage(ctx)
}

export type GeneratePDFInput = {
  schema: FormSchema
  values: Record<string, string | null>
  companyName: string
  period: string | null
  /** Per-submission drag overrides for templated forms. */
  overrides?: FieldOverrides
}

/**
 * Render a filled form PDF. When the form has a registered template
 * (an official agency PDF + coordinate map), draw values onto that
 * template. Otherwise fall back to a generic section-based layout so
 * forms we haven't templated yet still produce something printable.
 */
export async function generateFormPDF(
  input: GeneratePDFInput,
): Promise<Uint8Array> {
  const template = await getEffectiveTemplate(input.schema.form_code)
  if (template) {
    return renderOnTemplate({
      template,
      values: input.values,
      overrides: input.overrides,
    })
  }
  return generateGenericFormPDF(input)
}

async function generateGenericFormPDF({
  schema,
  values,
  companyName,
  period,
}: GeneratePDFInput): Promise<Uint8Array> {
  const pdf = await PDFDocument.create()
  pdf.setTitle(`${schema.form_code} - ${companyName}${period ? ` (${period})` : ""}`)
  pdf.setProducer("Quill")
  pdf.setCreator("Quill - AI Permit Advisor")

  const ctx: Ctx = {
    pdf,
    page: pdf.addPage([A4.width, A4.height]),
    font: await pdf.embedFont(StandardFonts.Helvetica),
    fontBold: await pdf.embedFont(StandardFonts.HelveticaBold),
    y: A4.height - MARGIN,
  }

  // --- Header
  ctx.page.drawText(sanitize(schema.form_code), {
    x: MARGIN,
    y: ctx.y,
    font: ctx.fontBold,
    size: 18,
  })
  ctx.y -= 22
  ctx.page.drawText(sanitize(schema.form_name), {
    x: MARGIN,
    y: ctx.y,
    font: ctx.font,
    size: 11,
    color: rgb(0.3, 0.3, 0.3),
  })
  ctx.y -= 24

  // Meta block (company, agency, period)
  const meta = [
    ["Filed for", companyName],
    ["Agency", schema.agency],
    ...(period ? [["Period", period] as [string, string]] : []),
  ]
  for (const [label, value] of meta) {
    ctx.page.drawText(sanitize(label.toUpperCase()), {
      x: MARGIN,
      y: ctx.y,
      font: ctx.font,
      size: 8,
      color: rgb(0.5, 0.5, 0.5),
    })
    ctx.page.drawText(sanitize(value), {
      x: MARGIN + 90,
      y: ctx.y,
      font: ctx.fontBold,
      size: 10,
    })
    ctx.y -= 14
  }
  ctx.y -= 6
  ctx.page.drawLine({
    start: { x: MARGIN, y: ctx.y },
    end: { x: MARGIN + CONTENT_WIDTH, y: ctx.y },
    thickness: 1,
    color: rgb(0, 0, 0),
  })
  ctx.y -= 20

  // --- Sections
  const sections = FORM_SECTIONS[schema.form_code] ?? [
    { title: "Fields", fieldIds: schema.fields.map((f) => f.id) },
  ]

  for (const section of sections) {
    ensureSpace(ctx, 40)
    // Section title
    ctx.page.drawText(sanitize(section.title.toUpperCase()), {
      x: MARGIN,
      y: ctx.y,
      font: ctx.fontBold,
      size: 9,
      color: rgb(0.4, 0.4, 0.4),
    })
    ctx.y -= 6
    ctx.page.drawLine({
      start: { x: MARGIN, y: ctx.y },
      end: { x: MARGIN + CONTENT_WIDTH, y: ctx.y },
      thickness: 0.5,
      color: rgb(0.8, 0.8, 0.8),
    })
    ctx.y -= 14

    for (const fieldId of section.fieldIds) {
      const field = schema.fields.find((f) => f.id === fieldId)
      if (!field) continue

      const label = sanitize(field.label)
      const valueText = sanitize(formatValue(field.semantic_type, values[fieldId] ?? null))
      const valueLines = wrapLines(valueText, ctx.fontBold, 10, CONTENT_WIDTH)

      const blockHeight = 12 + 12 * valueLines.length + 6
      ensureSpace(ctx, blockHeight)

      // Label
      ctx.page.drawText(label, {
        x: MARGIN,
        y: ctx.y,
        font: ctx.font,
        size: 8,
        color: rgb(0.45, 0.45, 0.45),
      })
      ctx.y -= 12
      // Value (possibly multi-line)
      const isMissing = valueText === "—"
      for (const line of valueLines) {
        ctx.page.drawText(line, {
          x: MARGIN,
          y: ctx.y,
          font: isMissing ? ctx.font : ctx.fontBold,
          size: 10,
          color: isMissing ? rgb(0.7, 0.7, 0.7) : rgb(0, 0, 0),
        })
        ctx.y -= 12
      }
      ctx.y -= 6
    }
    ctx.y -= 10
  }

  // --- Footer on every page
  const now = new Date().toISOString().slice(0, 19).replace("T", " ")
  const pages = pdf.getPages()
  for (let i = 0; i < pages.length; i++) {
    const p = pages[i]
    p.drawText(sanitize(`Generated by Quill - ${now}`), {
      x: MARGIN,
      y: 28,
      font: ctx.font,
      size: 8,
      color: rgb(0.55, 0.55, 0.55),
    })
    p.drawText(sanitize(`Page ${i + 1} of ${pages.length}`), {
      x: MARGIN + CONTENT_WIDTH - 60,
      y: 28,
      font: ctx.font,
      size: 8,
      color: rgb(0.55, 0.55, 0.55),
    })
  }

  return pdf.save()
}
