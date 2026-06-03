import { PDFDocument } from "pdf-lib"

export type AcroFormWidget = {
  name: string
  kind: "text" | "checkbox" | "radio" | "dropdown" | "other"
}

/**
 * Extract all AcroForm widget names from a template PDF. Used by the
 * AcroForm mapping editor's dropdown so admins map schema fields to
 * real PDF widgets without having to read the PDF by hand.
 */
export async function listAcroFormWidgets(
  pdfBytes: Uint8Array,
): Promise<AcroFormWidget[]> {
  const pdf = await PDFDocument.load(pdfBytes, { ignoreEncryption: true })
  const form = pdf.getForm()
  return form.getFields().map((f) => {
    const ctor = f.constructor.name
    let kind: AcroFormWidget["kind"] = "other"
    if (ctor === "PDFTextField") kind = "text"
    else if (ctor === "PDFCheckBox") kind = "checkbox"
    else if (ctor === "PDFRadioGroup") kind = "radio"
    else if (ctor === "PDFDropdown") kind = "dropdown"
    return { name: f.getName(), kind }
  })
}
