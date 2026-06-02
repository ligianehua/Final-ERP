"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Loader2, Move, Plus, RotateCcw, Save, Type } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { toast } from "@/components/ui/toaster"
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
  /**
   * Admin path: right-click on the PDF in layout mode → add a new
   * field at that exact PDF coordinate. Receiver is responsible for
   * persisting via PATCH /api/forms/templates/[form_code].
   */
  onAddField?: (spec: NewFieldRequest) => Promise<{
    ok: boolean
    message: string
  }>
}

/** Coords are in PDF points (top-down click position). The receiver
 * converts to pdf-lib bottom-up baseline-y when persisting. */
export type NewFieldRequest = {
  page: number
  /** PDF point coords of the click. */
  x: number
  y_top: number
  label: string
  semantic_type: string
  data_source: string | null
  required: boolean
}

const SEMANTIC_TYPES = [
  "company_name",
  "company_tin",
  "company_sec_no",
  "company_dti_no",
  "company_address",
  "company_city",
  "company_phone",
  "company_email",
  "company_vat_status",
  "period_month",
  "period_year",
  "amount",
  "signatory_name",
  "signatory_tin",
  "signatory_position",
  "text",
]

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
  onAddField,
}: Props) {
  const [displayWidth] = useState(MAX_DISPLAY_WIDTH)
  const [mode, setMode] = useState<EditMode>("values")
  const canRightClickAdd = isAdmin && mode === "layout" && !!onAddField
  const [pendingAdd, setPendingAdd] = useState<{
    page: number
    x_pdf: number
    y_top_pdf: number
  } | null>(null)
  const [pendingLabel, setPendingLabel] = useState("")
  const [pendingType, setPendingType] = useState("text")
  const [pendingSource, setPendingSource] = useState("")
  const [pendingRequired, setPendingRequired] = useState(false)
  const [adding, setAdding] = useState(false)

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

  const fieldCountByPage = useMemo(() => {
    const m: Record<number, number> = {}
    for (const [page, entries] of Object.entries(byPage)) {
      m[Number(page)] = entries.length
    }
    return m
  }, [byPage])

  const pageRefs = useRef<Array<HTMLDivElement | null>>([])
  const [activePage, setActivePage] = useState(1)

  useEffect(() => {
    // Highlight whichever page has the most viewport overlap. When the
    // user scrolls, the thumbnail strip follows.
    const els = pageRefs.current.filter(
      (el): el is HTMLDivElement => el !== null,
    )
    if (els.length === 0) return
    const io = new IntersectionObserver(
      (entries) => {
        let best: { page: number; ratio: number } | null = null
        for (const e of entries) {
          const page = Number(
            (e.target as HTMLElement).dataset.page ?? "0",
          )
          if (!page) continue
          if (!best || e.intersectionRatio > best.ratio) {
            best = { page, ratio: e.intersectionRatio }
          }
        }
        if (best && best.ratio > 0) setActivePage(best.page)
      },
      { threshold: [0, 0.25, 0.5, 0.75, 1] },
    )
    for (const el of els) io.observe(el)
    return () => io.disconnect()
  }, [template.dimensions.pageCount])

  function jumpToPage(p: number) {
    const el = pageRefs.current[p - 1]
    if (!el) return
    el.scrollIntoView({ behavior: "smooth", block: "start" })
  }

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

      {pageCount > 1 && (
        <PageThumbnailStrip
          formCode={formCode}
          pageCount={pageCount}
          pageImagePrefix={template.page_image_prefix}
          fieldCountByPage={fieldCountByPage}
          activePage={activePage}
          onJump={jumpToPage}
        />
      )}

      <div className="space-y-6">
        {Array.from({ length: pageCount }, (_, i) => i + 1).map((pageNum) => {
          const entries = byPage[pageNum] ?? []

          return (
            <div
              key={pageNum}
              ref={(el) => {
                pageRefs.current[pageNum - 1] = el
              }}
              data-page={pageNum}
              onContextMenu={(e) => {
                if (!canRightClickAdd) return
                e.preventDefault()
                const rect = e.currentTarget.getBoundingClientRect()
                setPendingAdd({
                  page: pageNum,
                  x_pdf: (e.clientX - rect.left) / scale,
                  y_top_pdf: (e.clientY - rect.top) / scale,
                })
                setPendingLabel("")
                setPendingType("text")
                setPendingSource("")
                setPendingRequired(false)
              }}
              className="relative mx-auto bg-white rounded-md border shadow-sm overflow-hidden scroll-mt-20"
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

              {canRightClickAdd && pendingAdd?.page === pageNum && (
                <div
                  className="absolute pointer-events-none border-2 border-primary rounded-sm bg-primary/10"
                  style={{
                    left: pendingAdd.x_pdf * scale,
                    top: pendingAdd.y_top_pdf * scale,
                    width: 160 * scale,
                    height: 14 * scale,
                  }}
                />
              )}

              <div className="absolute bottom-2 right-3 text-[10px] text-muted-foreground bg-white/80 px-1.5 py-0.5 rounded">
                Page {pageNum} of {pageCount}
                {canRightClickAdd && (
                  <span className="ml-2 text-primary">
                    · right-click to add field
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </div>

      <Dialog
        open={pendingAdd !== null && !adding}
        onOpenChange={(o) => {
          if (!o) setPendingAdd(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="inline-flex items-center gap-2">
              <Plus className="size-4 text-primary" />
              Add field at clicked position
            </DialogTitle>
            <DialogDescription>
              Page <span className="font-mono">{pendingAdd?.page}</span>{" "}
              at PDF point{" "}
              <span className="font-mono">
                ({pendingAdd?.x_pdf.toFixed(0)},{" "}
                {pendingAdd?.y_top_pdf.toFixed(0)})
              </span>
              . You can drag-tune it after saving.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="new_label" className="text-xs">
                Label
              </Label>
              <Input
                id="new_label"
                value={pendingLabel}
                onChange={(e) => setPendingLabel(e.target.value)}
                placeholder="TIN, Amount, Signature, etc."
                autoFocus
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="new_type" className="text-xs">
                  Semantic type
                </Label>
                <select
                  id="new_type"
                  value={pendingType}
                  onChange={(e) => setPendingType(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  {SEMANTIC_TYPES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="new_source" className="text-xs">
                  Data source (optional)
                </Label>
                <Input
                  id="new_source"
                  value={pendingSource}
                  onChange={(e) => setPendingSource(e.target.value)}
                  placeholder="company.tin"
                  className="font-mono text-xs"
                />
              </div>
            </div>
            <label className="inline-flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={pendingRequired}
                onChange={(e) => setPendingRequired(e.target.checked)}
                className="size-3.5"
              />
              <span>Required</span>
            </label>
          </div>
          <DialogFooter className="gap-2">
            <DialogClose asChild>
              <Button variant="outline" disabled={adding}>
                Cancel
              </Button>
            </DialogClose>
            <Button
              onClick={async () => {
                if (!pendingAdd || !onAddField) return
                if (!pendingLabel.trim()) {
                  toast({
                    variant: "destructive",
                    title: "Label required",
                    description: "Give the field a label first.",
                  })
                  return
                }
                setAdding(true)
                const result = await onAddField({
                  page: pendingAdd.page,
                  x: pendingAdd.x_pdf,
                  y_top: pendingAdd.y_top_pdf,
                  label: pendingLabel.trim(),
                  semantic_type: pendingType,
                  data_source: pendingSource.trim() || null,
                  required: pendingRequired,
                })
                setAdding(false)
                if (result.ok) {
                  setPendingAdd(null)
                  toast({
                    variant: "success",
                    title: "Field added",
                    description: result.message,
                  })
                } else {
                  toast({
                    variant: "destructive",
                    title: "Add failed",
                    description: result.message,
                  })
                }
              }}
              disabled={adding || !pendingLabel.trim()}
              className="gap-2"
            >
              {adding ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Plus className="size-4" />
              )}
              Add field
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function PageThumbnailStrip({
  formCode,
  pageCount,
  pageImagePrefix,
  fieldCountByPage,
  activePage,
  onJump,
}: {
  formCode: string
  pageCount: number
  pageImagePrefix: string
  fieldCountByPage: Record<number, number>
  activePage: number
  onJump: (page: number) => void
}) {
  return (
    <div className="sticky top-0 z-10 -mx-1 flex gap-2 overflow-x-auto rounded-md border bg-background/95 backdrop-blur px-2 py-2">
      <span className="self-center shrink-0 text-[10px] uppercase tracking-wide text-muted-foreground pr-1">
        Pages
      </span>
      {Array.from({ length: pageCount }, (_, i) => i + 1).map((p) => {
        const count = fieldCountByPage[p] ?? 0
        const isActive = activePage === p
        return (
          <button
            key={p}
            type="button"
            onClick={() => onJump(p)}
            aria-label={`Jump to page ${p}`}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "relative shrink-0 rounded-md border-2 overflow-hidden bg-white transition-all hover:border-foreground/60 focus:outline-none focus:border-foreground/60",
              isActive ? "border-foreground" : "border-transparent shadow-sm",
            )}
            style={{ width: 64 }}
          >
            <img
              src={`${pageImagePrefix}-${p}.png`}
              alt={`${formCode} page ${p} thumbnail`}
              draggable={false}
              className="block select-none pointer-events-none"
              style={{ width: "100%", height: "auto" }}
            />
            <span className="absolute inset-x-0 bottom-0 bg-foreground/80 text-background text-[9px] leading-none py-0.5 flex items-center justify-center gap-1">
              <span>P{p}</span>
              {count > 0 && (
                <span className="rounded-full bg-background/30 px-1 text-[8px]">
                  {count}
                </span>
              )}
            </span>
          </button>
        )
      })}
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
