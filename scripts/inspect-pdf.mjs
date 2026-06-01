import { PDFDocument } from "pdf-lib"
import { readFile } from "node:fs/promises"

const bytes = await readFile("public/form-templates/BIR_2550M.pdf")
const pdf = await PDFDocument.load(bytes)

console.log("Pages:", pdf.getPageCount())
const sizes = pdf.getPages().map((p, i) => `  p${i + 1}: ${p.getWidth().toFixed(1)} x ${p.getHeight().toFixed(1)}`)
console.log("Page sizes (pts):")
sizes.forEach((s) => console.log(s))

const form = pdf.getForm()
const fields = form.getFields()
console.log("\nAcroForm fields:", fields.length)
if (fields.length) {
  for (const f of fields) {
    console.log(`  ${f.constructor.name.padEnd(18)} "${f.getName()}"`)
  }
}
