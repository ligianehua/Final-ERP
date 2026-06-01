import { execFile } from "node:child_process"
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { promisify } from "node:util"
import { PDFDocument } from "pdf-lib"
import {
  getExtension,
  isImageExtension,
  isOfficeExtension,
} from "./supported"

const execFileAsync = promisify(execFile)

const SOFFICE_BIN = process.env.SOFFICE_PATH ?? "soffice"
const SOFFICE_TIMEOUT_MS = 90_000
const A4 = { width: 595.28, height: 841.89 } // points

export class ConversionError extends Error {
  constructor(message: string, readonly cause?: unknown) {
    super(message)
    this.name = "ConversionError"
  }
}

/**
 * Convert any supported document into a PDF.
 *
 * - `pdf`: returned unchanged
 * - `jpg/jpeg/png`: embedded as a single A4 page via pdf-lib
 * - office formats: rendered by LibreOffice headless
 *
 * Caller is responsible for whitelisting extensions before calling.
 */
export async function convertToPdf(
  fileBytes: Uint8Array,
  fileName: string,
): Promise<Uint8Array> {
  const ext = getExtension(fileName)

  if (ext === "pdf") return fileBytes
  if (isImageExtension(ext)) return embedImageInPdf(fileBytes, ext)
  if (isOfficeExtension(ext)) return runSoffice(fileBytes, ext)

  throw new ConversionError(`Unsupported file extension: .${ext}`)
}

async function embedImageInPdf(
  bytes: Uint8Array,
  ext: string,
): Promise<Uint8Array> {
  const pdf = await PDFDocument.create()
  const img =
    ext === "png" ? await pdf.embedPng(bytes) : await pdf.embedJpg(bytes)

  // Fit image to A4 while preserving aspect ratio.
  const scale = Math.min(A4.width / img.width, A4.height / img.height)
  const w = img.width * scale
  const h = img.height * scale

  const page = pdf.addPage([A4.width, A4.height])
  page.drawImage(img, {
    x: (A4.width - w) / 2,
    y: (A4.height - h) / 2,
    width: w,
    height: h,
  })
  return pdf.save()
}

async function runSoffice(
  bytes: Uint8Array,
  ext: string,
): Promise<Uint8Array> {
  // Each call gets its own sandbox so concurrent conversions don't collide
  // on LibreOffice's user-profile lock file.
  const workDir = await mkdtemp(join(tmpdir(), "quill-convert-"))
  const profileDir = join(workDir, "profile")
  const inputPath = join(workDir, `input.${ext}`)
  const outputPath = join(workDir, "input.pdf")

  try {
    await writeFile(inputPath, bytes)
    await execFileAsync(
      SOFFICE_BIN,
      [
        "--headless",
        `-env:UserInstallation=file://${profileDir}`,
        "--convert-to",
        "pdf",
        "--outdir",
        workDir,
        inputPath,
      ],
      { timeout: SOFFICE_TIMEOUT_MS },
    )
    return await readFile(outputPath)
  } catch (err) {
    throw new ConversionError(
      `LibreOffice conversion failed for .${ext}`,
      err,
    )
  } finally {
    await rm(workDir, { recursive: true, force: true }).catch(() => {})
  }
}
