import { execFile } from "node:child_process"
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { promisify } from "node:util"
import { convertToPdf } from "@/lib/convert/to-pdf"
import {
  getExtension,
  isImageExtension,
  isOfficeExtension,
} from "@/lib/convert/supported"

const execFileAsync = promisify(execFile)

export class ImageConversionError extends Error {
  constructor(message: string, readonly cause?: unknown) {
    super(message)
    this.name = "ImageConversionError"
  }
}

/**
 * Convert any supported document into a single PNG data URL suitable for
 * a vision LLM. Images pass through; PDFs render page 1 via pdftoppm;
 * Office formats first travel through the LibreOffice → PDF pipeline.
 */
export async function fileToImageDataUrl(
  bytes: Uint8Array,
  fileName: string,
): Promise<string> {
  const ext = getExtension(fileName)

  if (isImageExtension(ext)) {
    const mime = ext === "png" ? "image/png" : "image/jpeg"
    return `data:${mime};base64,${Buffer.from(bytes).toString("base64")}`
  }

  let pdfBytes: Uint8Array
  if (ext === "pdf") {
    pdfBytes = bytes
  } else if (isOfficeExtension(ext)) {
    pdfBytes = await convertToPdf(bytes, fileName)
  } else {
    throw new ImageConversionError(`Unsupported file type: .${ext}`)
  }

  const workDir = await mkdtemp(join(tmpdir(), "quill-img-"))
  try {
    const pdfPath = join(workDir, "input.pdf")
    await writeFile(pdfPath, pdfBytes)
    await execFileAsync(
      "pdftoppm",
      [
        "-r",
        "150",
        "-f",
        "1",
        "-l",
        "1",
        "-png",
        pdfPath,
        join(workDir, "page"),
      ],
      { timeout: 60_000 },
    )
    const pngPath = join(workDir, "page-1.png")
    const pngBytes = await readFile(pngPath)
    return `data:image/png;base64,${pngBytes.toString("base64")}`
  } catch (err) {
    throw new ImageConversionError("Failed to render PDF page 1 as image", err)
  } finally {
    await rm(workDir, { recursive: true, force: true }).catch(() => {})
  }
}
