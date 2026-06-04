/**
 * Formats the convert-to-pdf pipeline accepts.
 *
 * - `pdf`: passes through unchanged
 * - image: embedded into a single-page PDF via pdf-lib
 * - office: handed to LibreOffice (`soffice --headless --convert-to pdf`)
 */

export const IMAGE_EXTENSIONS = ["jpg", "jpeg", "png"] as const

export const OFFICE_EXTENSIONS = [
  // Spreadsheets
  "xls",
  "xlsx",
  "xlsm",
  "xlsb",
  "ods",
  "csv",
  // Word-processor
  "doc",
  "docx",
  "odt",
  "rtf",
  "txt",
  "html",
  "htm",
  // Presentations
  "ppt",
  "pptx",
  "odp",
] as const

export const CONVERTIBLE_EXTENSIONS = [
  "pdf",
  ...IMAGE_EXTENSIONS,
  ...OFFICE_EXTENSIONS,
] as const

export type ConvertibleExtension = (typeof CONVERTIBLE_EXTENSIONS)[number]

export function getExtension(filename: string): string {
  const match = filename.match(/\.([^.]+)$/)
  return match ? match[1].toLowerCase() : ""
}

export function isSupportedExtension(ext: string): ext is ConvertibleExtension {
  return (CONVERTIBLE_EXTENSIONS as readonly string[]).includes(ext)
}

export function isImageExtension(ext: string): boolean {
  return (IMAGE_EXTENSIONS as readonly string[]).includes(ext)
}

export function isOfficeExtension(ext: string): boolean {
  return (OFFICE_EXTENSIONS as readonly string[]).includes(ext)
}
