"use client"

import { useMemo, useState } from "react"
import { cn } from "@/lib/utils"
import type { CoordSpec, TemplateConfig } from "@/lib/forms/template-types"

type Field = {
  id: string
  label: string
  required: boolean
}

type Props = {
  formCode: string
  template: TemplateConfig
  fields: Field[]
  values: Record<string, string>
  /** Called when the user edits a slot. `id` is the coord-map key. */
  onChange: (id: string, value: string) => void
}

/**
 * Coord-map fields with no schema-side counterpart (e.g. `period_display`
 * is composed from `period_month` + `period_year`). The editor reads
 * and writes through these helpers so the underlying schema fields stay
 * the source of truth.
 */
function readVirtual(
  id: string,
  values: Record<string, string>,
): string | null {
  if (id === "period_display") {
    const m = values.period_month ?? ""
    const y = values.period_year ?? ""
    if (!m || !y) return null
    return `${m.padStart(2, "0")}/${y}`
  }
  return null
}

function writeVirtual(
  id: string,
  input: string,
  onChange: (id: string, value: string) => void,
): boolean {
  if (id === "period_display") {
    const m = input.match(/^(\d{1,2})\s*[/\-.\s]+\s*(\d{2,4})$/)
    if (m) {
      onChange("period_month", m[1].padStart(2, "0"))
      onChange("period_year", m[2].length === 2 ? `20${m[2]}` : m[2])
    } else if (input === "") {
      onChange("period_month", "")
      onChange("period_year", "")
    }
    return true
  }
  return false
}

function baseNameFromPath(pdfPath: string): string {
  const file = pdfPath.split("/").pop() ?? ""
  return file.replace(/\.pdf$/i, "")
}

const MAX_DISPLAY_WIDTH = 880

export function FormEditorOverlay({
  formCode,
  template,
  fields,
  values,
  onChange,
}: Props) {
  // Track which display width to use — re-measure on container resize would
  // be nicer, but a fixed cap keeps things simple for now.
  const [displayWidth] = useState(MAX_DISPLAY_WIDTH)

  const labelOf = useMemo(() => {
    const m = new Map<string, string>()
    for (const f of fields) m.set(f.id, f.label)
    return m
  }, [fields])

  // Group coord-map entries by page so each page renders only its inputs.
  // Returns {} for non-coordinate templates so the early branch below has
  // something to consume after the hooks fire.
  const byPage = useMemo(() => {
    const m: Record<number, Array<[string, CoordSpec]>> = {}
    if (template.mapping.strategy !== "coordinates") return m
    for (const [id, spec] of Object.entries(template.mapping.fields)) {
      ;(m[spec.page] ?? (m[spec.page] = [])).push([id, spec])
    }
    return m
  }, [template])

  if (template.mapping.strategy !== "coordinates") {
    return (
      <p className="text-sm text-muted-foreground">
        This template uses AcroForm fields; the visual editor is for
        coordinate templates only.
      </p>
    )
  }
  const { width: pdfW, height: pdfH, pageCount } = template.dimensions
  const scale = displayWidth / pdfW
  const displayHeight = pdfH * scale
  const baseName = baseNameFromPath(template.pdf_path)

  const isRequiredMissing = (id: string, val: string) => {
    if (val.trim() !== "") return false
    const f = fields.find((x) => x.id === id)
    return !!f?.required
  }

  return (
    <div className="space-y-6">
      {Array.from({ length: pageCount }, (_, i) => i + 1).map((pageNum) => {
        const entries = byPage[pageNum] ?? []
        // Hide pages that have no editable slots — for BIR 2550M only
        // page 1 has fields; pages 2-5 are static schedules / ATC reference.
        if (entries.length === 0) return null

        return (
          <div
            key={pageNum}
            className="relative mx-auto bg-white rounded-md border shadow-sm overflow-hidden"
            style={{ width: displayWidth, height: displayHeight }}
          >
            <img
              src={`/form-templates/${baseName}-${pageNum}.png`}
              alt={`${formCode} page ${pageNum}`}
              width={displayWidth}
              height={displayHeight}
              draggable={false}
              className="block select-none pointer-events-none"
            />
            {entries.map(([id, spec]) => {
              const size = spec.size ?? 10
              const width = spec.width ?? spec.maxWidth ?? 100
              const height = spec.height ?? size + 2

              // Anchor: spec.x is left/right/center edge depending on align.
              let boxLeftPdf = spec.x
              if (spec.align === "right") boxLeftPdf = spec.x - width
              else if (spec.align === "center") boxLeftPdf = spec.x - width / 2

              // pdf-lib y → CSS top (flip + account for box height).
              const boxBottomPdf = spec.y - 1
              const boxTopPdf = boxBottomPdf + height
              const cssTop = (pdfH - boxTopPdf) * scale
              const cssLeft = boxLeftPdf * scale
              const cssWidth = width * scale
              const cssHeight = height * scale
              const cssFontSize = size * scale

              const virtual = readVirtual(id, values)
              const value = virtual ?? values[id] ?? ""
              const required = isRequiredMissing(id, value)

              return (
                <input
                  key={id}
                  type="text"
                  value={value}
                  onChange={(e) => {
                    const next = e.target.value
                    if (!writeVirtual(id, next, onChange)) onChange(id, next)
                  }}
                  title={labelOf.get(id) ?? id}
                  className={cn(
                    "absolute bg-transparent border-0 outline-none",
                    "px-0.5 leading-none font-sans",
                    "hover:bg-amber-100/40 focus:bg-amber-100/70",
                    required && "ring-1 ring-red-300/70 bg-red-50/40",
                  )}
                  style={{
                    left: `${cssLeft}px`,
                    top: `${cssTop}px`,
                    width: `${cssWidth}px`,
                    height: `${cssHeight}px`,
                    fontSize: `${cssFontSize}px`,
                    textAlign: spec.align ?? "left",
                  }}
                />
              )
            })}
            <div className="absolute bottom-2 right-3 text-[10px] text-muted-foreground bg-white/80 px-1.5 py-0.5 rounded">
              Page {pageNum} of {pageCount}
            </div>
          </div>
        )
      })}
    </div>
  )
}
