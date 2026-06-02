import {
  PDFDocument,
  PDFFont,
  StandardFonts,
  TextAlignment,
} from "pdf-lib"
import { readFile } from "node:fs/promises"
import { join } from "node:path"
import { createAdminClient } from "@/lib/db/admin"
import type {
  AcroFormMapping,
  CoordSpec,
  CoordinateMapping,
  FieldOverrides,
  TemplateConfig,
  TemplateDimensions,
} from "./template-types"

// Re-export so existing imports of these types from render-on-template
// keep working.
export type {
  AcroFormMapping,
  CoordSpec,
  CoordinateMapping,
  FieldOverrides,
  TemplateConfig,
  TemplateDimensions,
}

export type RenderInput = {
  template: TemplateConfig
  values: Record<string, string | null>
  /** Per-submission drag adjustments applied on top of the template. */
  overrides?: FieldOverrides
}

/**
 * Load the template PDF either from the project filesystem
 * (code-shipped templates under `public/form-templates/`) or from
 * Supabase Storage (admin-uploaded templates under the `templates`
 * bucket). The TemplateConfig's `storage_bucket` is the selector.
 */
async function loadTemplateBytes(
  template: TemplateConfig,
): Promise<Uint8Array> {
  if (!template.storage_bucket) {
    return new Uint8Array(
      await readFile(join(process.cwd(), template.pdf_path)),
    )
  }
  // Service role: skip RLS, works inside cron/anonymous PDF-generation
  // paths as well as authenticated user requests.
  const admin = createAdminClient()
  const { data, error } = await admin.storage
    .from(template.storage_bucket)
    .download(template.pdf_path)
  if (error || !data) {
    throw new Error(
      `Storage fetch failed for ${template.storage_bucket}/${template.pdf_path}: ${error?.message ?? "no data"}`,
    )
  }
  return new Uint8Array(await data.arrayBuffer())
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
  overrides = {},
}: RenderInput): Promise<Uint8Array> {
  const bytes = await loadTemplateBytes(template)
  const pdf = await PDFDocument.load(bytes)
  pdf.setProducer("Quill")

  const finalValues = template.transformValues
    ? template.transformValues(values)
    : values

  if (template.mapping.strategy === "acroform") {
    return fillByAcroForm(pdf, template.mapping.fields, finalValues)
  }
  const adjusted = applyOverrides(template.mapping.fields, overrides)
  return fillByCoordinates(pdf, adjusted, finalValues)
}

function applyOverrides(
  base: Record<string, CoordSpec>,
  overrides: FieldOverrides,
): Record<string, CoordSpec> {
  const out: Record<string, CoordSpec> = {}
  for (const [id, spec] of Object.entries(base)) {
    const o = overrides[id]
    out[id] = o ? { ...spec, x: spec.x + o.dx, y: spec.y + o.dy } : spec
  }
  return out
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
  // Intentionally NOT flattening — leave fields editable post-download.
  return pdf.save()
}

/**
 * Coordinate-mapped templates emit real AcroForm text fields at each
 * mapped position, pre-filled with the value (or empty if no value).
 * That way the downloaded PDF stays editable in Reader / Preview / browser.
 */
async function fillByCoordinates(
  pdf: PDFDocument,
  mapping: Record<string, CoordSpec>,
  values: Record<string, string | null>,
): Promise<Uint8Array> {
  const form = pdf.getForm()
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  const pages = pdf.getPages()

  for (const [fieldId, spec] of Object.entries(mapping)) {
    const pageIdx = spec.page - 1
    if (pageIdx < 0 || pageIdx >= pages.length) continue
    const page = pages[pageIdx]

    const size = spec.size ?? 10
    const width = spec.width ?? spec.maxWidth ?? 100
    // Box hugs the text tightly so the viewer-added focus highlight
    // doesn't bleed onto the next row of the printed form.
    const height = spec.height ?? size + 2

    // Anchor: spec.x is the LEFT edge for left-align, RIGHT edge for
    // right-align, CENTER for center-align.
    let boxX = spec.x
    if (spec.align === "right") boxX = spec.x - width
    else if (spec.align === "center") boxX = spec.x - width / 2

    // Convert text baseline → field-box bottom (1pt descender margin).
    const boxY = spec.y - 1

    const raw = values[fieldId]
    const text = raw ? sanitize(raw) : ""

    // Names must be unique within the form; prefix to avoid collisions
    // with whatever existing form fields a hand-crafted PDF might have.
    const field = form.createTextField(`quill.${fieldId}`)
    field.setText(text)
    if (spec.align === "right") field.setAlignment(TextAlignment.Right)
    else if (spec.align === "center") field.setAlignment(TextAlignment.Center)

    field.addToPage(page, {
      x: boxX,
      y: boxY,
      width,
      height,
      font,
      borderWidth: 0, // invisible until focused
    })
    // /DA entry is only populated by addToPage; setFontSize must follow it.
    field.setFontSize(size)
  }

  // Don't flatten — user can re-edit after download.
  return pdf.save()
}

// Re-export so coord-map files can stay decoupled from the renderer file.
export { truncate, sanitize }
