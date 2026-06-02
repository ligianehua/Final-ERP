"use client"

import { useMemo, useRef, useState } from "react"
import { Loader2, Move, RotateCcw, Save, Type } from "lucide-react"
import { cn } from "@/lib/utils"
import type {
  CoordSpec,
  FieldOverrides,
  TemplateConfig,
  TemplateDimensions,
} from "@/lib/forms/template-types"

type Field = {
  id: string
  label: string
  required: boolean
}

/**
 * Shape passed from the server to the editor. `page_image_prefix` is
 * appended with `-1.png`, `-2.png`, etc. — points at /public for
 * code-side templates, at the Storage CDN URL for DB-only ones.
 */
export type EditorTemplate = {
  dimensions: TemplateDimensions
  mapping: TemplateConfig["mapping"]
  page_image_prefix: string
}

type Props = {
  formCode: string
  template: EditorTemplate
  fields: Field[]
  values: Record<string, string>
  /** Called when the user edits a slot. `id` is the coord-map key. */
  onChange: (id: string, value: string) => void
  /** Per-submission drag overrides. */
  overrides: FieldOverrides
  /** Set a single field's override, or pass null to remove it. */
  onOverrideChange: (
    id: string,
    override: { dx: number; dy: number } | null,
  ) => void
  /** Show "Save as template default" affordance. */
  isAdmin?: boolean
  /** Persist current overrides as the new template default. */
  onSaveAsTemplate?: () => Promise<{ ok: boolean; message: string }>
}

type EditMode = "values" | "layout"

const MAX_DISPLAY_WIDTH = 880

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

export function FormEditorOverlay({
  formCode,
  template,
  fields,
  values,
  onChange,
  overrides,
  onOverrideChange,
  isAdmin = false,
  onSaveAsTemplate,
}: Props) {
  const [displayWidth] = useState(MAX_DISPLAY_WIDTH)
  const [mode, setMode] = useState<EditMode>("values")

  const labelOf = useMemo(() => {
    const m = new Map<string, string>()
    for (const f of fields) m.set(f.id, f.label)
    return m
  }, [fields])

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

  const isRequiredMissing = (id: string, val: string) => {
    if (val.trim() !== "") return false
    const f = fields.find((x) => x.id === id)
    return !!f?.required
  }

  return (
    <div className="space-y-3">
      <ModeBar
        mode={mode}
        onModeChange={setMode}
        overrideCount={Object.keys(overrides).length}
        onResetAll={() => {
          for (const id of Object.keys(overrides)) onOverrideChange(id, null)
        }}
        isAdmin={isAdmin}
        onSaveAsTemplate={onSaveAsTemplate}
      />

      <div className="space-y-6">
        {Array.from({ length: pageCount }, (_, i) => i + 1).map((pageNum) => {
          const entries = byPage[pageNum] ?? []
          if (entries.length === 0) return null

          return (
            <div
              key={pageNum}
              className="relative mx-auto bg-white rounded-md border shadow-sm overflow-hidden"
              style={{ width: displayWidth, height: displayHeight }}
            >
              <img
                src={`${template.page_image_prefix}-${pageNum}.png`}
                alt={`${formCode} page ${pageNum}`}
                width={displayWidth}
                height={displayHeight}
                draggable={false}
                className="block select-none pointer-events-none"
              />

              {entries.map(([id, spec]) => (
                <FieldCell
                  key={id}
                  id={id}
                  spec={spec}
                  override={overrides[id]}
                  scale={scale}
                  pdfH={pdfH}
                  mode={mode}
                  label={labelOf.get(id) ?? id}
                  value={readVirtual(id, values) ?? values[id] ?? ""}
                  required={isRequiredMissing(
                    id,
                    readVirtual(id, values) ?? values[id] ?? "",
                  )}
                  onValueChange={(next) => {
                    if (!writeVirtual(id, next, onChange)) onChange(id, next)
                  }}
                  onOverrideChange={onOverrideChange}
                />
              ))}

              <div className="absolute bottom-2 right-3 text-[10px] text-muted-foreground bg-white/80 px-1.5 py-0.5 rounded">
                Page {pageNum} of {pageCount}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function ModeBar({
  mode,
  onModeChange,
  overrideCount,
  onResetAll,
  isAdmin,
  onSaveAsTemplate,
}: {
  mode: EditMode
  onModeChange: (m: EditMode) => void
  overrideCount: number
  onResetAll: () => void
  isAdmin: boolean
  onSaveAsTemplate?: () => Promise<{ ok: boolean; message: string }>
}) {
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState<{ ok: boolean; message: string } | null>(
    null,
  )

  async function handleSaveAsTemplate() {
    if (!onSaveAsTemplate) return
    setSaving(true)
    setStatus(null)
    const result = await onSaveAsTemplate()
    setSaving(false)
    setStatus(result)
    setTimeout(() => setStatus(null), 4000)
  }

  return (
    <div className="flex items-center justify-between gap-3 rounded-md border bg-muted/40 px-3 py-2 text-xs">
      <div className="inline-flex rounded-md border bg-background overflow-hidden">
        <button
          type="button"
          onClick={() => onModeChange("values")}
          className={cn(
            "inline-flex items-center gap-1.5 px-3 py-1.5 transition-colors",
            mode === "values"
              ? "bg-foreground text-background"
              : "text-muted-foreground hover:bg-muted",
          )}
        >
          <Type className="size-3.5" /> Edit values
        </button>
        <button
          type="button"
          onClick={() => onModeChange("layout")}
          className={cn(
            "inline-flex items-center gap-1.5 px-3 py-1.5 transition-colors",
            mode === "layout"
              ? "bg-foreground text-background"
              : "text-muted-foreground hover:bg-muted",
          )}
        >
          <Move className="size-3.5" /> Edit layout
        </button>
      </div>

      <div className="flex items-center gap-3">
        {status && (
          <span
            className={cn(
              "transition-opacity",
              status.ok ? "text-green-700" : "text-destructive",
            )}
          >
            {status.message}
          </span>
        )}
        {overrideCount > 0 && (
          <>
            <span className="text-muted-foreground">
              {overrideCount} field{overrideCount === 1 ? "" : "s"} repositioned
            </span>
            <button
              type="button"
              onClick={onResetAll}
              disabled={saving}
              className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground disabled:opacity-50"
            >
              <RotateCcw className="size-3" /> Reset all
            </button>
            {isAdmin && onSaveAsTemplate && (
              <button
                type="button"
                onClick={handleSaveAsTemplate}
                disabled={saving}
                title="Bake current positions in as the new default for everyone"
                className="inline-flex items-center gap-1 text-foreground hover:underline disabled:opacity-50"
              >
                {saving ? (
                  <Loader2 className="size-3 animate-spin" />
                ) : (
                  <Save className="size-3" />
                )}
                Save as template default
              </button>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function FieldCell({
  id,
  spec,
  override,
  scale,
  pdfH,
  mode,
  label,
  value,
  required,
  onValueChange,
  onOverrideChange,
}: {
  id: string
  spec: CoordSpec
  override: { dx: number; dy: number } | undefined
  scale: number
  pdfH: number
  mode: EditMode
  label: string
  value: string
  required: boolean
  onValueChange: (next: string) => void
  onOverrideChange: Props["onOverrideChange"]
}) {
  const size = spec.size ?? 10
  const width = spec.width ?? spec.maxWidth ?? 100
  const height = spec.height ?? size + 2

  const effectiveX = spec.x + (override?.dx ?? 0)
  const effectiveY = spec.y + (override?.dy ?? 0)

  let boxLeftPdf = effectiveX
  if (spec.align === "right") boxLeftPdf = effectiveX - width
  else if (spec.align === "center") boxLeftPdf = effectiveX - width / 2

  const boxBottomPdf = effectiveY - 1
  const boxTopPdf = boxBottomPdf + height
  const cssTop = (pdfH - boxTopPdf) * scale
  const cssLeft = boxLeftPdf * scale
  const cssWidth = width * scale
  const cssHeight = height * scale
  const cssFontSize = size * scale

  const isDragging = useRef(false)

  function startDrag(e: React.MouseEvent) {
    e.preventDefault()
    isDragging.current = true
    const startMX = e.clientX
    const startMY = e.clientY
    const initial = override ?? { dx: 0, dy: 0 }

    function handleMove(ev: MouseEvent) {
      const dPx = ev.clientX - startMX
      const dPy = ev.clientY - startMY
      onOverrideChange(id, {
        dx: initial.dx + dPx / scale,
        // CSS top grows down; PDF y grows up. Flip.
        dy: initial.dy - dPy / scale,
      })
    }

    function handleUp() {
      isDragging.current = false
      window.removeEventListener("mousemove", handleMove)
      window.removeEventListener("mouseup", handleUp)
    }

    window.addEventListener("mousemove", handleMove)
    window.addEventListener("mouseup", handleUp)
  }

  return (
    <>
      <input
        type="text"
        value={value}
        onChange={(e) => onValueChange(e.target.value)}
        title={label}
        readOnly={mode === "layout"}
        tabIndex={mode === "layout" ? -1 : 0}
        className={cn(
          "absolute bg-transparent border-0 outline-none",
          "px-0.5 leading-none font-sans",
          mode === "values" && "hover:bg-amber-100/40 focus:bg-amber-100/70",
          mode === "values" &&
            required &&
            "ring-1 ring-red-300/70 bg-red-50/40",
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

      {mode === "layout" && (
        <div
          onMouseDown={startDrag}
          onDoubleClick={() => onOverrideChange(id, null)}
          title={`${label} — drag to move, double-click to reset`}
          className={cn(
            "absolute cursor-move group",
            "border border-blue-500/50 bg-blue-500/10 hover:bg-blue-500/20",
            override && "border-amber-500/70 bg-amber-500/15",
          )}
          style={{
            left: `${cssLeft}px`,
            top: `${cssTop}px`,
            width: `${cssWidth}px`,
            height: `${cssHeight}px`,
          }}
        >
          <span
            className={cn(
              "absolute -top-4 left-0 px-1 py-0.5 rounded text-[10px] whitespace-nowrap",
              "bg-blue-600 text-white opacity-0 group-hover:opacity-100",
              "transition-opacity pointer-events-none",
              override && "bg-amber-600",
            )}
          >
            {label}
            {override && (
              <span className="ml-1 opacity-80">
                · Δ{override.dx > 0 ? "+" : ""}
                {override.dx.toFixed(0)},{override.dy > 0 ? "+" : ""}
                {override.dy.toFixed(0)}
              </span>
            )}
          </span>
        </div>
      )}
    </>
  )
}
