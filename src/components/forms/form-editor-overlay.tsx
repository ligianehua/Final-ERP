"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  LayoutGrid,
  List,
  Loader2,
  Magnet,
  Move,
  Plus,
  Redo2,
  RotateCcw,
  Save,
  Search,
  Type,
  Undo2,
  X,
} from "lucide-react"
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
    override: { dx: number; dy: number; dw?: number; dh?: number } | null,
  ) => void
  /**
   * Wholesale replace — used by the undo/redo stack to restore an
   * earlier snapshot in one go.
   */
  onReplaceOverrides?: (next: FieldOverrides) => void
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
  /** Per-field locks currently held by OTHER admins. Dragging /
   * editing these cells is blocked; a small lock badge marks them. */
  fieldLocksByOther?: Record<string, { email: string | null; at: string }>
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
  onReplaceOverrides,
  isAdmin = false,
  onSaveAsTemplate,
  onAddField,
  fieldLocksByOther = {},
}: Props) {
  const [displayWidth] = useState(MAX_DISPLAY_WIDTH)
  const [mode, setMode] = useState<EditMode>("values")

  // Undo / redo stacks — only meaningful when the parent passes
  // onReplaceOverrides (admin Layout mode). Each entry is a snapshot
  // of the entire FieldOverrides map taken just before a drag/resize
  // starts, so a single revert returns to the pre-gesture state.
  const undoStack = useRef<FieldOverrides[]>([])
  const redoStack = useRef<FieldOverrides[]>([])
  const [undoCount, setUndoCount] = useState(0)
  const [redoCount, setRedoCount] = useState(0)

  const snapshotOverrides = useCallback(() => {
    if (!onReplaceOverrides) return
    // Deep-copy so later mutations don't bleed back into history.
    undoStack.current.push(
      Object.fromEntries(
        Object.entries(overrides).map(([k, v]) => [k, { ...v }]),
      ),
    )
    redoStack.current = []
    setUndoCount(undoStack.current.length)
    setRedoCount(0)
  }, [overrides, onReplaceOverrides])

  const undo = useCallback(() => {
    if (!onReplaceOverrides) return
    const prev = undoStack.current.pop()
    if (!prev) return
    redoStack.current.push(overrides)
    onReplaceOverrides(prev)
    setUndoCount(undoStack.current.length)
    setRedoCount(redoStack.current.length)
  }, [overrides, onReplaceOverrides])

  const redo = useCallback(() => {
    if (!onReplaceOverrides) return
    const next = redoStack.current.pop()
    if (!next) return
    undoStack.current.push(overrides)
    onReplaceOverrides(next)
    setUndoCount(undoStack.current.length)
    setRedoCount(redoStack.current.length)
  }, [overrides, onReplaceOverrides])

  // Click-select fields in Layout mode so the keyboard can nudge them.
  // Shift/Cmd/Ctrl-click extends the set so arrow keys move whole
  // groups at once. Cleared on Esc, mode switch, or empty-page click.
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  // Live drag tracker — drives the alignment-guide overlay.
  const [draggingId, setDraggingId] = useState<string | null>(null)
  // Layout-mode UX state — snap-to-grid, search-highlight, and the
  // view toggle for the table-instead-of-PDF mode.
  const [snapToGrid, setSnapToGrid] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [viewMode, setViewMode] = useState<"pdf" | "table">("pdf")
  const GRID_SIZE = 5

  function selectField(id: string, additive: boolean) {
    setSelectedIds((prev) => {
      if (!additive) return new Set([id])
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  useEffect(() => {
    if (mode !== "layout") setSelectedIds(new Set())
  }, [mode])

  // Match-set for the search highlight. Null = search box is empty
  // (no dimming at all); otherwise = the ids that matched.
  const matchSet = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (q === "") return null
    const m = new Set<string>()
    for (const f of fields) {
      if (
        f.label.toLowerCase().includes(q) ||
        f.id.toLowerCase().includes(q)
      ) {
        m.add(f.id)
      }
    }
    return m
  }, [searchQuery, fields])

  // Keyboard handlers: arrow nudges the selection, Cmd/Ctrl+Z undoes,
  // +Shift redoes, Esc clears selection. Suspended while the user is
  // typing in a value input (or in the search box).
  useEffect(() => {
    if (mode !== "layout") return
    function handler(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null
      const tag = target?.tagName
      const typing =
        tag === "INPUT" || tag === "TEXTAREA" || target?.isContentEditable
      const isMod = e.ctrlKey || e.metaKey
      if (isMod && e.key.toLowerCase() === "z") {
        if (!onReplaceOverrides) return
        e.preventDefault()
        if (e.shiftKey) redo()
        else undo()
        return
      }
      if (e.key === "Escape") {
        setSelectedIds(new Set())
        return
      }
      if (typing) return
      if (
        selectedIds.size > 0 &&
        ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)
      ) {
        e.preventDefault()
        const step = e.shiftKey ? 10 : 1
        snapshotOverrides()
        // Apply the same delta to every selected field. We use the
        // bulk-replace path when the parent supports it so the entire
        // multi-field move counts as one undo step.
        if (onReplaceOverrides) {
          const next = { ...overrides }
          for (const id of selectedIds) {
            const cur = next[id] ?? { dx: 0, dy: 0 }
            let dx = cur.dx
            let dy = cur.dy
            if (e.key === "ArrowLeft") dx -= step
            if (e.key === "ArrowRight") dx += step
            if (e.key === "ArrowUp") dy += step
            if (e.key === "ArrowDown") dy -= step
            next[id] = { ...cur, dx, dy }
          }
          onReplaceOverrides(next)
        } else {
          for (const id of selectedIds) {
            const cur = overrides[id] ?? { dx: 0, dy: 0 }
            let dx = cur.dx
            let dy = cur.dy
            if (e.key === "ArrowLeft") dx -= step
            if (e.key === "ArrowRight") dx += step
            if (e.key === "ArrowUp") dy += step
            if (e.key === "ArrowDown") dy -= step
            onOverrideChange(id, { dx, dy, dw: cur.dw, dh: cur.dh })
          }
        }
      }
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [
    mode,
    onReplaceOverrides,
    undo,
    redo,
    selectedIds,
    overrides,
    onOverrideChange,
    snapshotOverrides,
  ])
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

  // Rect of every field in PDF coords (after overrides). Used by the
  // alignment-guide overlay to compare the dragging field's edges
  // against its siblings on the same page.
  const allRects = useMemo(() => {
    const m: Record<
      string,
      { id: string; page: number; left: number; right: number; top: number; bottom: number }
    > = {}
    if (template.mapping.strategy !== "coordinates") return m
    for (const [id, spec] of Object.entries(template.mapping.fields)) {
      const o = overrides[id]
      const baseW = spec.width ?? spec.maxWidth ?? 100
      const baseH = spec.height ?? (spec.size ?? 10) + 2
      const dx = o?.dx ?? 0
      const dy = o?.dy ?? 0
      const dw = o?.dw ?? 0
      const dh = o?.dh ?? 0
      const w = Math.max(20, baseW + dw)
      const h = Math.max(8, baseH + dh)
      const effX = spec.x + dx
      const effY = spec.y + dy - dh
      let leftPdf = effX
      if (spec.align === "right") leftPdf = effX - w
      else if (spec.align === "center") leftPdf = effX - w / 2
      // In display coords (top-down) so guide lines map to CSS easily.
      const topDisplay = template.dimensions.height - (effY + h - 1)
      const bottomDisplay = topDisplay + h
      m[id] = {
        id,
        page: spec.page,
        left: leftPdf,
        right: leftPdf + w,
        top: topDisplay,
        bottom: bottomDisplay,
      }
    }
    return m
  }, [template, overrides])

  // Guides for whichever page the dragging field lives on. Match
  // tolerance is small — admins want a confident snap-feel without
  // ghost lines flickering on every pixel.
  const TOL = 2
  const guides = useMemo(() => {
    if (!draggingId) return [] as Array<{
      page: number
      axis: "v" | "h"
      coord: number
      anchorId: string
    }>
    const drag = allRects[draggingId]
    if (!drag) return []
    const out: Array<{
      page: number
      axis: "v" | "h"
      coord: number
      anchorId: string
    }> = []
    for (const r of Object.values(allRects)) {
      if (r.id === drag.id || r.page !== drag.page) continue
      // Vertical guides (column alignment)
      const lefts = [drag.left, drag.right]
      for (const l of lefts) {
        if (Math.abs(r.left - l) <= TOL)
          out.push({ page: r.page, axis: "v", coord: r.left, anchorId: r.id })
        if (Math.abs(r.right - l) <= TOL)
          out.push({ page: r.page, axis: "v", coord: r.right, anchorId: r.id })
      }
      // Horizontal guides (row alignment)
      const tops = [drag.top, drag.bottom]
      for (const t of tops) {
        if (Math.abs(r.top - t) <= TOL)
          out.push({ page: r.page, axis: "h", coord: r.top, anchorId: r.id })
        if (Math.abs(r.bottom - t) <= TOL)
          out.push({ page: r.page, axis: "h", coord: r.bottom, anchorId: r.id })
      }
    }
    return out
  }, [draggingId, allRects])

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
          snapshotOverrides()
          for (const id of Object.keys(overrides)) onOverrideChange(id, null)
        }}
        isAdmin={isAdmin}
        onSaveAsTemplate={onSaveAsTemplate}
        undoCount={undoCount}
        redoCount={redoCount}
        onUndo={undo}
        onRedo={redo}
        showUndo={!!onReplaceOverrides && mode === "layout"}
      />

      {mode === "layout" && (
        <LayoutSubBar
          snapToGrid={snapToGrid}
          onSnapToGridChange={setSnapToGrid}
          gridSize={GRID_SIZE}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          matchCount={matchSet?.size}
          totalFields={fields.length}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          selectedCount={selectedIds.size}
          onClearSelection={() => setSelectedIds(new Set())}
        />
      )}

      {mode === "layout" && viewMode === "table" ? (
        <FieldTable
          fields={fields}
          mapping={
            template.mapping.strategy === "coordinates"
              ? template.mapping.fields
              : {}
          }
          overrides={overrides}
          selectedIds={selectedIds}
          matchSet={matchSet}
          onSelect={selectField}
          onOverrideChange={onOverrideChange}
          onGestureStart={snapshotOverrides}
          onJumpToPDF={(id, page) => {
            setViewMode("pdf")
            setSelectedIds(new Set([id]))
            // Defer the scroll so the page divs have a chance to mount.
            setTimeout(() => jumpToPage(page), 50)
          }}
        />
      ) : (
        <>
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
              onMouseDown={(e) => {
                // Click on empty page area (no field) clears selection.
                if (mode === "layout" && e.target === e.currentTarget) {
                  setSelectedIds(new Set())
                }
              }}
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

              {/* Alignment guides — drawn UNDER the field cells so
                  they don't intercept clicks. */}
              {guides
                .filter((g) => g.page === pageNum)
                .map((g, i) =>
                  g.axis === "v" ? (
                    <div
                      key={`gv-${i}`}
                      className="absolute pointer-events-none border-l border-dashed border-fuchsia-500/80"
                      style={{
                        left: g.coord * scale,
                        top: 0,
                        height: displayHeight,
                      }}
                    />
                  ) : (
                    <div
                      key={`gh-${i}`}
                      className="absolute pointer-events-none border-t border-dashed border-fuchsia-500/80"
                      style={{
                        top: g.coord * scale,
                        left: 0,
                        width: displayWidth,
                      }}
                    />
                  ),
                )}

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
                  onGestureStart={snapshotOverrides}
                  selected={selectedIds.has(id)}
                  onSelect={(additive) => selectField(id, additive)}
                  onDragStateChange={(active) =>
                    setDraggingId(active ? id : null)
                  }
                  dimmed={matchSet !== null && !matchSet.has(id)}
                  highlighted={matchSet !== null && matchSet.has(id)}
                  snapToGrid={snapToGrid}
                  gridSize={GRID_SIZE}
                  lockedByOther={fieldLocksByOther[id]}
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
        </>
      )}

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
  undoCount,
  redoCount,
  onUndo,
  onRedo,
  showUndo,
}: {
  mode: EditMode
  onModeChange: (m: EditMode) => void
  overrideCount: number
  onResetAll: () => void
  isAdmin: boolean
  onSaveAsTemplate?: () => Promise<{ ok: boolean; message: string }>
  undoCount: number
  redoCount: number
  onUndo: () => void
  onRedo: () => void
  showUndo: boolean
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
        {showUndo && (
          <div className="inline-flex items-center gap-1 mr-1">
            <button
              type="button"
              onClick={onUndo}
              disabled={undoCount === 0}
              title="Undo (Ctrl/Cmd+Z)"
              className="inline-flex items-center gap-1 px-2 py-1 rounded hover:bg-muted disabled:opacity-40 disabled:hover:bg-transparent"
            >
              <Undo2 className="size-3.5" />
              <span className="text-[10px] text-muted-foreground">
                {undoCount > 0 ? undoCount : ""}
              </span>
            </button>
            <button
              type="button"
              onClick={onRedo}
              disabled={redoCount === 0}
              title="Redo (Ctrl/Cmd+Shift+Z)"
              className="inline-flex items-center gap-1 px-2 py-1 rounded hover:bg-muted disabled:opacity-40 disabled:hover:bg-transparent"
            >
              <Redo2 className="size-3.5" />
              <span className="text-[10px] text-muted-foreground">
                {redoCount > 0 ? redoCount : ""}
              </span>
            </button>
          </div>
        )}
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
  onGestureStart,
  selected,
  onSelect,
  onDragStateChange,
  dimmed,
  highlighted,
  snapToGrid,
  gridSize,
  lockedByOther,
}: {
  id: string
  spec: CoordSpec
  override:
    | { dx: number; dy: number; dw?: number; dh?: number }
    | undefined
  scale: number
  pdfH: number
  mode: EditMode
  label: string
  value: string
  required: boolean
  onValueChange: (next: string) => void
  onOverrideChange: Props["onOverrideChange"]
  /** Snapshot for undo before this field's first gesture starts. */
  onGestureStart?: () => void
  selected?: boolean
  /** `additive` = caller held Shift/Cmd/Ctrl while clicking. */
  onSelect?: (additive: boolean) => void
  /** Called when a drag/resize gesture starts/ends so the overlay can
   *  draw alignment guides for the duration of the gesture. */
  onDragStateChange?: (active: boolean) => void
  /** Search-highlight muting. */
  dimmed?: boolean
  highlighted?: boolean
  /** Round drag deltas so the final absolute x/y lands on the grid. */
  snapToGrid?: boolean
  gridSize?: number
  /** Held by another admin → block drag/resize, mark visually. */
  lockedByOther?: { email: string | null; at: string }
}) {
  const grid = gridSize ?? 5
  const size = spec.size ?? 10
  const baseWidth = spec.width ?? spec.maxWidth ?? 100
  const baseHeight = spec.height ?? size + 2

  const dx = override?.dx ?? 0
  const dy = override?.dy ?? 0
  const dw = override?.dw ?? 0
  const dh = override?.dh ?? 0

  // Width/height grow toward the bottom-right; baseline-y is
  // compensated by -dh so the screen TOP stays anchored.
  const width = Math.max(20, baseWidth + dw)
  const height = Math.max(8, baseHeight + dh)
  const effectiveX = spec.x + dx
  const effectiveY = spec.y + dy - dh

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

  function snapAbsolute(absolute: number): number {
    if (!snapToGrid) return absolute
    return Math.round(absolute / grid) * grid
  }

  function startDrag(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    onSelect?.(e.shiftKey || e.metaKey || e.ctrlKey)
    onGestureStart?.()
    isDragging.current = true
    onDragStateChange?.(true)
    const startMX = e.clientX
    const startMY = e.clientY
    const initial = {
      dx: override?.dx ?? 0,
      dy: override?.dy ?? 0,
      dw: override?.dw,
      dh: override?.dh,
    }

    function handleMove(ev: MouseEvent) {
      const dPx = ev.clientX - startMX
      const dPy = ev.clientY - startMY
      const rawX = spec.x + initial.dx + dPx / scale
      // CSS top grows down; PDF y grows up. Flip.
      const rawY = spec.y + initial.dy - dPy / scale
      onOverrideChange(id, {
        dx: snapAbsolute(rawX) - spec.x,
        dy: snapAbsolute(rawY) - spec.y,
        dw: initial.dw,
        dh: initial.dh,
      })
    }

    function handleUp() {
      isDragging.current = false
      onDragStateChange?.(false)
      window.removeEventListener("mousemove", handleMove)
      window.removeEventListener("mouseup", handleUp)
    }

    window.addEventListener("mousemove", handleMove)
    window.addEventListener("mouseup", handleUp)
  }

  function startResize(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    onSelect?.(e.shiftKey || e.metaKey || e.ctrlKey)
    onGestureStart?.()
    onDragStateChange?.(true)
    const startMX = e.clientX
    const startMY = e.clientY
    const initial = {
      dx: override?.dx ?? 0,
      dy: override?.dy ?? 0,
      dw: override?.dw ?? 0,
      dh: override?.dh ?? 0,
    }

    function handleMove(ev: MouseEvent) {
      const dPx = ev.clientX - startMX
      const dPy = ev.clientY - startMY
      const rawW = baseWidth + initial.dw + dPx / scale
      const rawH = baseHeight + initial.dh + dPy / scale
      onOverrideChange(id, {
        dx: initial.dx,
        dy: initial.dy,
        dw: snapAbsolute(rawW) - baseWidth,
        dh: snapAbsolute(rawH) - baseHeight,
      })
    }

    function handleUp() {
      onDragStateChange?.(false)
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
          onMouseDown={lockedByOther ? undefined : startDrag}
          onDoubleClick={
            lockedByOther ? undefined : () => onOverrideChange(id, null)
          }
          title={
            lockedByOther
              ? `${label} — locked by ${lockedByOther.email ?? "another admin"}`
              : `${label} — drag to move, corner to resize, arrows to nudge (Shift = 10pt), double-click to reset`
          }
          className={cn(
            "absolute group transition-opacity",
            lockedByOther
              ? "cursor-not-allowed border-2 border-amber-500/70 bg-amber-500/20"
              : "cursor-move border border-blue-500/50 bg-blue-500/10 hover:bg-blue-500/20",
            !lockedByOther && override && "border-amber-500/70 bg-amber-500/15",
            selected &&
              "ring-2 ring-primary ring-offset-1 border-primary/80 bg-primary/15",
            highlighted &&
              "ring-2 ring-yellow-400/90 border-yellow-500/80 bg-yellow-300/25",
            dimmed && "opacity-25 hover:opacity-60",
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
                · Δ{dx > 0 ? "+" : ""}
                {dx.toFixed(0)},{dy > 0 ? "+" : ""}
                {dy.toFixed(0)}
                {(dw !== 0 || dh !== 0) && (
                  <>
                    {" · "}
                    {(baseWidth + dw).toFixed(0)}×
                    {(baseHeight + dh).toFixed(0)}
                  </>
                )}
              </span>
            )}
          </span>
          {/* Bottom-right resize handle — visible on hover, anchored
              to the box's bottom-right corner. */}
          {!lockedByOther && (
            <div
              onMouseDown={startResize}
              title="Drag to resize"
              className={cn(
                "absolute right-0 bottom-0 size-2.5 cursor-se-resize",
                "bg-blue-600 opacity-0 group-hover:opacity-100",
                "transition-opacity",
                override && "bg-amber-600",
              )}
              style={{ transform: "translate(50%, 50%)" }}
            />
          )}
          {lockedByOther && (
            <span
              className="absolute -top-4 left-0 px-1 py-0.5 rounded text-[10px] whitespace-nowrap bg-amber-600 text-white pointer-events-none"
              title={`Locked by ${lockedByOther.email ?? "another admin"}`}
            >
              🔒 {lockedByOther.email ?? "locked"}
            </span>
          )}
        </div>
      )}
    </>
  )
}

function LayoutSubBar({
  snapToGrid,
  onSnapToGridChange,
  gridSize,
  searchQuery,
  onSearchChange,
  matchCount,
  totalFields,
  viewMode,
  onViewModeChange,
  selectedCount,
  onClearSelection,
}: {
  snapToGrid: boolean
  onSnapToGridChange: (next: boolean) => void
  gridSize: number
  searchQuery: string
  onSearchChange: (next: string) => void
  matchCount?: number
  totalFields: number
  viewMode: "pdf" | "table"
  onViewModeChange: (m: "pdf" | "table") => void
  selectedCount: number
  onClearSelection: () => void
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md border bg-background px-2 py-1.5 text-xs">
      <button
        type="button"
        onClick={() => onSnapToGridChange(!snapToGrid)}
        title={`Snap to ${gridSize}pt grid (${snapToGrid ? "on" : "off"})`}
        className={cn(
          "inline-flex items-center gap-1 px-2 py-1 rounded border transition-colors",
          snapToGrid
            ? "bg-foreground text-background border-foreground"
            : "border-transparent text-muted-foreground hover:bg-muted",
        )}
      >
        <Magnet className="size-3.5" />
        Snap {gridSize}pt
      </button>

      <div className="relative flex-1 min-w-[150px] max-w-[280px]">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Find a field…"
          className="h-7 w-full rounded border border-input bg-background pl-7 pr-12 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => onSearchChange("")}
            title="Clear search"
            className="absolute right-1 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-muted"
          >
            <X className="size-3 text-muted-foreground" />
          </button>
        )}
        {matchCount !== undefined && (
          <span className="absolute right-6 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground tabular-nums">
            {matchCount}/{totalFields}
          </span>
        )}
      </div>

      {selectedCount > 0 && (
        <span className="inline-flex items-center gap-1.5 text-muted-foreground">
          <span className="font-medium text-foreground">{selectedCount}</span>{" "}
          selected
          <button
            type="button"
            onClick={onClearSelection}
            className="p-0.5 rounded hover:bg-muted"
            title="Clear selection (Esc)"
          >
            <X className="size-3" />
          </button>
        </span>
      )}

      <div className="ml-auto inline-flex rounded-md border bg-background overflow-hidden">
        <button
          type="button"
          onClick={() => onViewModeChange("pdf")}
          className={cn(
            "inline-flex items-center gap-1 px-2 py-1 transition-colors",
            viewMode === "pdf"
              ? "bg-foreground text-background"
              : "text-muted-foreground hover:bg-muted",
          )}
          title="PDF view"
        >
          <LayoutGrid className="size-3.5" /> PDF
        </button>
        <button
          type="button"
          onClick={() => onViewModeChange("table")}
          className={cn(
            "inline-flex items-center gap-1 px-2 py-1 transition-colors",
            viewMode === "table"
              ? "bg-foreground text-background"
              : "text-muted-foreground hover:bg-muted",
          )}
          title="Table view"
        >
          <List className="size-3.5" /> Table
        </button>
      </div>
    </div>
  )
}

function FieldTable({
  fields,
  mapping,
  overrides,
  selectedIds,
  matchSet,
  onSelect,
  onOverrideChange,
  onGestureStart,
  onJumpToPDF,
}: {
  fields: Field[]
  mapping: Record<string, CoordSpec>
  overrides: FieldOverrides
  selectedIds: Set<string>
  matchSet: Set<string> | null
  onSelect: (id: string, additive: boolean) => void
  onOverrideChange: Props["onOverrideChange"]
  onGestureStart?: () => void
  onJumpToPDF: (id: string, page: number) => void
}) {
  // Header drives sort/select-all. Rows = whatever order the mapping
  // delivers them — admins can search/filter via the SubBar.
  const ordered = useMemo(() => {
    const present = fields.filter((f) => mapping[f.id])
    return present.sort((a, b) => {
      const pa = mapping[a.id]?.page ?? 1
      const pb = mapping[b.id]?.page ?? 1
      if (pa !== pb) return pa - pb
      return a.label.localeCompare(b.label)
    })
  }, [fields, mapping])

  const visible = useMemo(() => {
    if (!matchSet) return ordered
    return ordered.filter((f) => matchSet.has(f.id))
  }, [ordered, matchSet])

  return (
    <div className="border rounded-md overflow-hidden">
      <table className="w-full text-xs">
        <thead className="bg-muted/40 text-muted-foreground sticky top-0">
          <tr>
            <th className="w-8 px-2 py-2"></th>
            <th className="text-left px-3 py-2 font-medium">Label</th>
            <th className="text-left px-3 py-2 font-medium w-14">Page</th>
            <th className="text-right px-2 py-2 font-medium w-20">X</th>
            <th className="text-right px-2 py-2 font-medium w-20">Y</th>
            <th className="text-right px-2 py-2 font-medium w-20">W</th>
            <th className="text-right px-2 py-2 font-medium w-20">H</th>
            <th className="w-12 px-2 py-2"></th>
          </tr>
        </thead>
        <tbody>
          {visible.map((f) => {
            const spec = mapping[f.id]
            const o = overrides[f.id]
            const baseW = spec.width ?? spec.maxWidth ?? 100
            const baseH = spec.height ?? (spec.size ?? 10) + 2
            const x = spec.x + (o?.dx ?? 0)
            const y = spec.y + (o?.dy ?? 0) - (o?.dh ?? 0)
            const w = Math.max(20, baseW + (o?.dw ?? 0))
            const h = Math.max(8, baseH + (o?.dh ?? 0))
            const isSelected = selectedIds.has(f.id)
            return (
              <tr
                key={f.id}
                className={cn(
                  "border-t hover:bg-muted/30",
                  isSelected && "bg-primary/5",
                )}
              >
                <td className="px-2 py-2 align-top text-center">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={(e) =>
                      onSelect(
                        f.id,
                        e.nativeEvent instanceof MouseEvent
                          ? e.nativeEvent.shiftKey
                          : true,
                      )
                    }
                    className="size-3.5 mt-1"
                  />
                </td>
                <td className="px-3 py-2 align-top">
                  <button
                    type="button"
                    onClick={(e) =>
                      onSelect(
                        f.id,
                        e.shiftKey || e.metaKey || e.ctrlKey,
                      )
                    }
                    className="text-left hover:underline"
                  >
                    {f.label}
                  </button>
                  <div className="text-[10px] font-mono text-muted-foreground">
                    {f.id}
                  </div>
                </td>
                <td className="px-3 py-2 align-top font-mono text-[11px] text-muted-foreground">
                  P{spec.page}
                </td>
                <NumberCell
                  value={x}
                  onCommit={(v) => {
                    onGestureStart?.()
                    onOverrideChange(f.id, {
                      dx: v - spec.x,
                      dy: o?.dy ?? 0,
                      dw: o?.dw,
                      dh: o?.dh,
                    })
                  }}
                />
                <NumberCell
                  value={y}
                  onCommit={(v) => {
                    onGestureStart?.()
                    onOverrideChange(f.id, {
                      dx: o?.dx ?? 0,
                      dy: v + (o?.dh ?? 0) - spec.y,
                      dw: o?.dw,
                      dh: o?.dh,
                    })
                  }}
                />
                <NumberCell
                  value={w}
                  onCommit={(v) => {
                    onGestureStart?.()
                    onOverrideChange(f.id, {
                      dx: o?.dx ?? 0,
                      dy: o?.dy ?? 0,
                      dw: v - baseW,
                      dh: o?.dh ?? 0,
                    })
                  }}
                />
                <NumberCell
                  value={h}
                  onCommit={(v) => {
                    onGestureStart?.()
                    onOverrideChange(f.id, {
                      dx: o?.dx ?? 0,
                      dy: o?.dy ?? 0,
                      dw: o?.dw ?? 0,
                      dh: v - baseH,
                    })
                  }}
                />
                <td className="px-2 py-2 align-top text-right">
                  <button
                    type="button"
                    onClick={() => onJumpToPDF(f.id, spec.page)}
                    className="text-[10px] text-muted-foreground hover:text-foreground"
                    title="Switch to PDF view and scroll to this field"
                  >
                    Locate
                  </button>
                </td>
              </tr>
            )
          })}
          {visible.length === 0 && (
            <tr>
              <td
                colSpan={8}
                className="px-3 py-6 text-center text-muted-foreground"
              >
                {matchSet
                  ? "No fields match the search."
                  : "No coord-mapped fields on this template."}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

function NumberCell({
  value,
  onCommit,
}: {
  value: number
  onCommit: (next: number) => void
}) {
  const [draft, setDraft] = useState(value.toFixed(1))

  // Keep the input in sync if the underlying value moves (e.g. drag in
  // a different view, or undo).
  useEffect(() => {
    setDraft(value.toFixed(1))
  }, [value])

  function commit() {
    const parsed = Number(draft)
    if (!Number.isFinite(parsed)) {
      setDraft(value.toFixed(1))
      return
    }
    if (Math.abs(parsed - value) > 0.05) onCommit(parsed)
    else setDraft(value.toFixed(1))
  }

  return (
    <td className="px-1 py-1 align-top">
      <input
        type="number"
        step={0.5}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur()
        }}
        className="w-full h-7 px-1 text-right font-mono text-[11px] rounded border border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring"
      />
    </td>
  )
}
