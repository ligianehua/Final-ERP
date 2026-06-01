#!/usr/bin/env node
/**
 * Render a test BIR 2550M PDF with sample values, so we can visually
 * verify the coordinate map in `src/lib/forms/templates/bir-2550m.ts`.
 *
 * Re-implements the renderer minimally to avoid a TS toolchain step.
 * Update SAMPLE / COORDS below when the real coord map changes.
 *
 *   node scripts/test-render-bir.mjs
 *   pdftoppm -r 100 -png /tmp/test-bir-filled.pdf /tmp/test-bir
 */
import { readFile, writeFile } from "node:fs/promises"
import { PDFDocument, StandardFonts } from "pdf-lib"

const PAGE_H = 1008
const fromTop = (yTop) => PAGE_H - yTop

// MUST mirror src/lib/forms/templates/bir-2550m.ts
const COORDS = {
  period_display: { page: 1, x: 175, y: fromTop(82), size: 10 },
  tin: { page: 1, x: 60, y: fromTop(120), size: 11 },
  rdo_code: { page: 1, x: 240, y: fromTop(120), size: 11 },
  line_of_business: { page: 1, x: 340, y: fromTop(120), size: 9, maxWidth: 200 },
  registered_name: { page: 1, x: 40, y: fromTop(143), size: 11, maxWidth: 410 },
  telephone: { page: 1, x: 470, y: fromTop(143), size: 10, maxWidth: 110 },
  registered_address: { page: 1, x: 40, y: fromTop(168), size: 10, maxWidth: 410 },
  gross_sales: { page: 1, x: 425, y: fromTop(222), size: 10, align: "right" },
  output_tax: { page: 1, x: 570, y: fromTop(222), size: 10, align: "right" },
  input_tax: { page: 1, x: 570, y: fromTop(453), size: 10, align: "right" },
  vat_payable: { page: 1, x: 570, y: fromTop(685), size: 10, align: "right" },
  signatory_name: { page: 1, x: 80, y: fromTop(730), size: 10, maxWidth: 220 },
  signatory_position: { page: 1, x: 80, y: fromTop(778), size: 9, maxWidth: 140 },
  signatory_tin: { page: 1, x: 220, y: fromTop(778), size: 9 },
}

// Realistic sample taxpayer
const SAMPLE = {
  period_month: "01",
  period_year: "2026",
  tin: "123-456-789-000",
  rdo_code: "045",
  line_of_business: "Wholesale Trading",
  registered_name: "Quill Demo Trading Corporation",
  telephone: "(02) 8888-1234",
  registered_address: "123 Quill Avenue, Brgy. San Antonio, Makati City",
  gross_sales: "1,250,000.00",
  output_tax: "150,000.00",
  input_tax: "85,000.00",
  vat_payable: "65,000.00",
  signatory_name: "Maria S. Cruz",
  signatory_position: "President",
  signatory_tin: "987-654-321-000",
}

// derive period_display the way TemplateConfig.transformValues would
SAMPLE.period_display = `${SAMPLE.period_month.padStart(2, "0")}/${SAMPLE.period_year}`

const bytes = await readFile("public/form-templates/BIR_2550M.pdf")
const pdf = await PDFDocument.load(bytes)
const font = await pdf.embedFont(StandardFonts.Helvetica)
const pages = pdf.getPages()

for (const [key, spec] of Object.entries(COORDS)) {
  const raw = SAMPLE[key]
  if (!raw) continue
  const size = spec.size ?? 10
  let x = spec.x
  if (spec.align === "right") x -= font.widthOfTextAtSize(raw, size)
  else if (spec.align === "center") x -= font.widthOfTextAtSize(raw, size) / 2
  pages[spec.page - 1].drawText(raw, { x, y: spec.y, font, size })
}

const out = await pdf.save()
await writeFile("/tmp/test-bir-filled.pdf", out)
console.log(`✓ /tmp/test-bir-filled.pdf  (${(out.length / 1024).toFixed(1)} KB)`)
