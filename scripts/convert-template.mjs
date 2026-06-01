#!/usr/bin/env node
/**
 * Dev-time helper: convert a form template (XLS/DOC/etc.) into PDF and drop
 * it into `public/form-templates/`. Used to bake the BIR 2550M template and
 * the other system-shipped forms.
 *
 *   node scripts/convert-template.mjs <input-file> [output-name]
 *
 * Mirrors the runtime pipeline in `src/lib/convert/to-pdf.ts` — both call
 * `soffice --headless --convert-to pdf` with the same flags.
 */
import { execFile } from "node:child_process"
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { basename, extname, join, resolve } from "node:path"
import { promisify } from "node:util"

const execFileAsync = promisify(execFile)

const [, , inputArg, outputArg] = process.argv
if (!inputArg) {
  console.error("Usage: node scripts/convert-template.mjs <input-file> [output-name]")
  process.exit(1)
}

const inputPath = resolve(inputArg)
const inputExt = extname(inputPath).slice(1).toLowerCase()
if (!inputExt) {
  console.error(`Cannot detect extension for ${inputPath}`)
  process.exit(1)
}

const baseName = outputArg ?? basename(inputPath, extname(inputPath))
const outputDir = resolve("public", "form-templates")
const outputPath = join(outputDir, `${baseName}.pdf`)

await mkdir(outputDir, { recursive: true })

const workDir = await mkdtemp(join(tmpdir(), "quill-template-"))
const profileDir = join(workDir, "profile")
const stagedInput = join(workDir, `input.${inputExt}`)
const stagedOutput = join(workDir, "input.pdf")

try {
  const bytes = await readFile(inputPath)
  await writeFile(stagedInput, bytes)

  console.log(`→ soffice --convert-to pdf ${basename(inputPath)}`)
  const { stderr } = await execFileAsync(
    "soffice",
    [
      "--headless",
      `-env:UserInstallation=file://${profileDir}`,
      "--convert-to",
      "pdf",
      "--outdir",
      workDir,
      stagedInput,
    ],
    { timeout: 90_000 },
  )
  if (stderr) process.stderr.write(stderr)

  const pdf = await readFile(stagedOutput)
  await writeFile(outputPath, pdf)
  console.log(`✓ wrote ${outputPath} (${(pdf.length / 1024).toFixed(1)} KB)`)
} finally {
  await rm(workDir, { recursive: true, force: true }).catch(() => {})
}
