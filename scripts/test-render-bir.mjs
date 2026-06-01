#!/usr/bin/env node
/**
 * Render a test BIR 2550M PDF with sample values via real AcroForm
 * fields (matching the runtime renderer), so we can:
 *   1. Visually verify coordinate positions
 *   2. Confirm fields are editable in Reader / Preview / browser
 *
 * Re-implements the renderer minimally to avoid a TS toolchain step.
 * Keep COORDS in sync with `src/lib/forms/templates/bir-2550m.ts`.
 *
 *   node scripts/test-render-bir.mjs
 *   pdftoppm -r 100 -png /tmp/test-bir-filled.pdf /tmp/test-bir
 */
import { readFile, writeFile } from "node:fs/promises"
import { PDFDocument, StandardFonts, TextAlignment } from "pdf-lib"

const PAGE_H = 1008
const fromTop = (yTop) => PAGE_H - yTop

// MUST mirror src/lib/forms/templates/bir-2550m.ts
const COORDS = {
  period_display: { page: 1, x: 175, y: fromTop(82), width: 100, height: 14, size: 10 },
  tin: { page: 1, x: 45, y: fromTop(120), width: 170, height: 14, size: 11 },
  rdo_code: { page: 1, x: 235, y: fromTop(120), width: 70, height: 14, size: 11 },
  line_of_business: { page: 1, x: 335, y: fromTop(120), width: 240, height: 14, size: 9 },
  registered_name: { page: 1, x: 35, y: fromTop(143), width: 420, height: 14, size: 11 },
  telephone: { page: 1, x: 465, y: fromTop(143), width: 115, height: 14, size: 10 },
  registered_address: { page: 1, x: 35, y: fromTop(168), width: 420, height: 14, size: 10 },
  gross_sales: { page: 1, x: 430, y: fromTop(222), width: 140, height: 14, size: 10, align: "right" },
  output_tax: { page: 1, x: 585, y: fromTop(222), width: 130, height: 14, size: 10, align: "right" },
  input_tax: { page: 1, x: 585, y: fromTop(453), width: 130, height: 14, size: 10, align: "right" },
  vat_payable: { page: 1, x: 585, y: fromTop(685), width: 130, height: 14, size: 10, align: "right" },
  signatory_name: { page: 1, x: 70, y: fromTop(730), width: 230, height: 14, size: 10 },
  signatory_position: { page: 1, x: 70, y: fromTop(778), width: 150, height: 14, size: 9 },
  signatory_tin: { page: 1, x: 220, y: fromTop(778), width: 120, height: 14, size: 9 },
}

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
SAMPLE.period_display = `${SAMPLE.period_month.padStart(2, "0")}/${SAMPLE.period_year}`

const bytes = await readFile("public/form-templates/BIR_2550M.pdf")
const pdf = await PDFDocument.load(bytes)
const form = pdf.getForm()
const font = await pdf.embedFont(StandardFonts.Helvetica)
const pages = pdf.getPages()

for (const [key, spec] of Object.entries(COORDS)) {
  const raw = SAMPLE[key] ?? ""
  const size = spec.size ?? 10
  const width = spec.width ?? 100
  const height = spec.height ?? size + 4
  let boxX = spec.x
  if (spec.align === "right") boxX = spec.x - width
  else if (spec.align === "center") boxX = spec.x - width / 2
  const boxY = spec.y - 2

  const field = form.createTextField(`quill.${key}`)
  field.setText(raw)
  if (spec.align === "right") field.setAlignment(TextAlignment.Right)
  else if (spec.align === "center") field.setAlignment(TextAlignment.Center)
  field.addToPage(pages[spec.page - 1], {
    x: boxX, y: boxY, width, height, font, borderWidth: 0,
  })
  // /DA entry is only created during addToPage; setFontSize must come after.
  field.setFontSize(size)
}

const out = await pdf.save()
await writeFile("/tmp/test-bir-filled.pdf", out)
console.log(`✓ /tmp/test-bir-filled.pdf  (${(out.length / 1024).toFixed(1)} KB)`)
console.log(`  AcroForm fields: ${form.getFields().length}`)
