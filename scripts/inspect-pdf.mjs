#!/usr/bin/env node
/**
 * Inspect a PDF template:
 *   - page count + sizes
 *   - AcroForm fields (name + widget type)
 *
 * Use this when you bring in a new form template to decide which fill
 * strategy applies: AcroForm (path 1) or coordinate map (path 2).
 *
 *   node scripts/inspect-pdf.mjs <pdf-file>
 */
import { readFile } from "node:fs/promises"
import { resolve } from "node:path"
import { PDFDocument } from "pdf-lib"

const [, , pathArg] = process.argv
if (!pathArg) {
  console.error("Usage: node scripts/inspect-pdf.mjs <pdf-file>")
  process.exit(1)
}

const filePath = resolve(pathArg)
const bytes = await readFile(filePath)
const pdf = await PDFDocument.load(bytes)

console.log(`File: ${filePath}`)
console.log(`Pages: ${pdf.getPageCount()}`)
console.log("Page sizes (pts):")
for (const [i, page] of pdf.getPages().entries()) {
  const w = page.getWidth().toFixed(1)
  const h = page.getHeight().toFixed(1)
  const note = w === "595.3" && h === "841.9" ? " (A4)" : w === "612.0" && h === "1008.0" ? " (US Legal)" : w === "612.0" && h === "792.0" ? " (US Letter)" : ""
  console.log(`  p${i + 1}: ${w} x ${h}${note}`)
}

const fields = pdf.getForm().getFields()
console.log(`\nAcroForm fields: ${fields.length}`)
if (fields.length > 0) {
  console.log("  Strategy → fill by field name (path 1)")
  for (const f of fields) {
    console.log(`    ${f.constructor.name.padEnd(18)} "${f.getName()}"`)
  }
} else {
  console.log("  Strategy → coordinate map (path 2)")
}
