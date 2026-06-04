import { execFile } from "node:child_process"
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises"
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
  const urls = await fileToImageDataUrls(bytes, fileName, { maxPages: 1 })
  if (urls.length === 0) {
    throw new ImageConversionError("No pages rendered")
  }
  return urls[0]
}

/**
 * Multi-page variant. Renders every page (or the first `maxPages`) as
 * a PNG and returns them in page order as data URLs.
 *
 * For images this still returns a single-element array (the image
 * itself); for Office files we round-trip through PDF first.
 */
export async function fileToImageDataUrls(
  bytes: Uint8Array,
  fileName: string,
  opts: { maxPages?: number } = {},
): Promise<string[]> {
  const ext = getExtension(fileName)

  if (isImageExtension(ext)) {
    const mime = ext === "png" ? "image/png" : "image/jpeg"
    return [`data:${mime};base64,${Buffer.from(bytes).toString("base64")}`]
  }

  let pdfBytes: Uint8Array
  if (ext === "pdf") {
    pdfBytes = bytes
  } else if (isOfficeExtension(ext)) {
    pdfBytes = await convertToPdf(bytes, fileName)
  } else {
    throw new ImageConversionError(`Unsupported file type: .${ext}`)
  }

  const workDir = await mkdtemp(join(tmpdir(), "quill-imgs-"))
  try {
    const pdfPath = join(workDir, "input.pdf")
    await writeFile(pdfPath, pdfBytes)
    const args = ["-r", "150", "-png"]
    if (opts.maxPages) {
      args.push("-f", "1", "-l", String(opts.maxPages))
    }
    args.push(pdfPath, join(workDir, "page"))
    await execFileAsync("pdftoppm", args, { timeout: 120_000 })

    const pageNum = (name: string) =>
      Number(name.replace(/^page-/, "").replace(/\.png$/, ""))
    const pngFiles = (await readdir(workDir))
      .filter((f) => f.startsWith("page-") && f.endsWith(".png"))
      .sort((a, b) => pageNum(a) - pageNum(b))

    const dataUrls: string[] = []
    for (const name of pngFiles) {
      const pngBytes = await readFile(join(workDir, name))
      dataUrls.push(`data:image/png;base64,${pngBytes.toString("base64")}`)
    }
    return dataUrls
  } catch (err) {
    throw new ImageConversionError("Failed to render PDF pages as images", err)
  } finally {
    await rm(workDir, { recursive: true, force: true }).catch(() => {})
  }
}
