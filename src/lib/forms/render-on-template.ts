import { PDFDocument, PDFFont, StandardFonts } from "pdf-lib"
import { readFile } from "node:fs/promises"
import { join } from "node:path"

/**
 * Where (and how) to draw a single value on a coordinate-mapped PDF.
 *
 * pdf-lib uses a bottom-left origin: y grows upward. Coordinates are in
 * PDF points (1 pt = 1/72 inch). For US Legal pages, the page is
 * 612 wide × 1008 tall.
 */
export type CoordSpec = {
  /** 1-indexed page number. */
  page: number
  x: number
  y: number
  /** Font size in points. Defaults to 10. */
  size?: number
  /** Horizontal anchor for `x`. Defaults to "left". */
  align?: "left" | "right" | "center"
  /** If set, text is truncated with "…" once it exceeds this width. */
  maxWidth?: number
}

export type AcroFormMapping = {
  strategy: "acroform"
  /** schema field id → AcroForm widget name */
  fields: Record<string, string>
}

export type CoordinateMapping = {
  strategy: "coordinates"
  /** schema field id → where on the page to draw the value */
  fields: Record<string, CoordSpec>
}

export type TemplateConfig = {
  /** Path to the template PDF, relative to project root. */
  pdf_path: string
  mapping: AcroFormMapping | CoordinateMapping
  /**
   * Optional value transformer applied before rendering. Use it to derive
   * composite fields (e.g. `period` from `period_month` + `period_year`).
   */
  transformValues?: (
    values: Record<string, string | null>,
  ) => Record<string, string | null>
}

export type RenderInput = {
  template: TemplateConfig
  values: Record<string, string | null>
}

/**
 * Helvetica doesn't include the Philippine peso glyph or common smart
 * punctuation. Substitute so they don't render as missing-glyph boxes.
 */
function sanitize(text: string): string {
  return text
    .replace(/₱/g, "PHP ")
    .replace(/[—–]/g, "-")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
}

function truncate(text: string, font: PDFFont, size: number, max: number): string {
  if (font.widthOfTextAtSize(text, size) <= max) return text
  let lo = 0
  let hi = text.length
  while (lo < hi) {
    const mid = (lo + hi + 1) >>> 1
    const candidate = text.slice(0, mid) + "…"
    if (font.widthOfTextAtSize(candidate, size) <= max) lo = mid
    else hi = mid - 1
  }
  return text.slice(0, lo) + "…"
}

export async function renderOnTemplate({
  template,
  values,
}: RenderInput): Promise<Uint8Array> {
  const bytes = await readFile(join(process.cwd(), template.pdf_path))
  const pdf = await PDFDocument.load(bytes)
  pdf.setProducer("Quill")

  const finalValues = template.transformValues
    ? template.transformValues(values)
    : values

  if (template.mapping.strategy === "acroform") {
    return fillByAcroForm(pdf, template.mapping.fields, finalValues)
  }
  return fillByCoordinates(pdf, template.mapping.fields, finalValues)
}

async function fillByAcroForm(
  pdf: PDFDocument,
  mapping: Record<string, string>,
  values: Record<string, string | null>,
): Promise<Uint8Array> {
  const form = pdf.getForm()
  for (const [schemaId, fieldName] of Object.entries(mapping)) {
    const raw = values[schemaId]
    if (!raw) continue
    try {
      form.getTextField(fieldName).setText(sanitize(raw))
    } catch {
      // Field might be a checkbox / dropdown / missing. Coordinate-fallback
      // and per-template overrides are future work; skip silently for now.
    }
  }
  form.flatten()
  return pdf.save()
}

async function fillByCoordinates(
  pdf: PDFDocument,
  mapping: Record<string, CoordSpec>,
  values: Record<string, string | null>,
): Promise<Uint8Array> {
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  const pages = pdf.getPages()

  for (const [schemaId, spec] of Object.entries(mapping)) {
    const raw = values[schemaId]
    if (!raw) continue

    const pageIdx = spec.page - 1
    if (pageIdx < 0 || pageIdx >= pages.length) continue
    const page = pages[pageIdx]

    const size = spec.size ?? 10
    let text = sanitize(raw)
    if (spec.maxWidth) text = truncate(text, font, size, spec.maxWidth)

    let drawX = spec.x
    if (spec.align === "right") {
      drawX -= font.widthOfTextAtSize(text, size)
    } else if (spec.align === "center") {
      drawX -= font.widthOfTextAtSize(text, size) / 2
    }

    page.drawText(text, { x: drawX, y: spec.y, font, size })
  }

  return pdf.save()
}
