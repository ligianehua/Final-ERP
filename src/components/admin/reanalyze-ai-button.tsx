"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { CheckCircle2, Loader2, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { toast } from "@/components/ui/toaster"

type ApproxPos = {
  x_pct: number
  y_pct: number
  width_pct: number
  height_pct: number
} | null

type ReanalyzedField = {
  label: string
  semantic_type: string
  data_source: string | null
  required: boolean
  approximate_position: ApproxPos
  notes: string | null
  page: number
}

type PageSummary = {
  page: number
  field_count: number
  confidence: number
  error: string | null
}

type Analysis = {
  issuer: { name: string; abbreviation: string | null }
  form_name: string
  form_code_suggested: string
  fields: ReanalyzedField[]
  confidence: number
  reasoning: string
}

type ExistingField = {
  id: string
  label: string
  semantic_type: string
  data_source: string | null
  required: boolean
  period_specific: boolean
}

type ExistingMapping = Record<
  string,
  {
    page: number
    x: number
    y: number
    width?: number
    height?: number
    size?: number
    align?: "left" | "right" | "center"
  }
>

type Props = {
  formCode: string
  formName: string
  agency: string
  dimensions: { width: number; height: number; pageCount: number }
  existingFields: ExistingField[]
  existingMapping: ExistingMapping
}

function slugifyId(label: string, existing: Set<string>): string {
  const base =
    label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 40) || "field"
  if (!existing.has(base)) return base
  for (let i = 2; i < 1000; i++) {
    const c = `${base}_${i}`
    if (!existing.has(c)) return c
  }
  return `${base}_${Date.now()}`
}

export function ReanalyzeAIButton({
  formCode,
  formName,
  agency,
  dimensions,
  existingFields,
  existingMapping,
}: Props) {
  const router = useRouter()
  const [analyzing, setAnalyzing] = useState(false)
  const [merging, setMerging] = useState(false)
  const [open, setOpen] = useState(false)
  const [analysis, setAnalysis] = useState<Analysis | null>(null)
  const [perPage, setPerPage] = useState<PageSummary[]>([])
  const [included, setIncluded] = useState<boolean[]>([])

  const existingLabels = new Set(
    existingFields.map((f) => f.label.toLowerCase().trim()),
  )

  async function handleReanalyze() {
    setAnalyzing(true)
    const res = await fetch(
      `/api/forms/templates/${encodeURIComponent(formCode)}/reanalyze`,
      { method: "POST" },
    )
    setAnalyzing(false)
    if (!res.ok) {
      const json = await res.json().catch(() => ({}))
      toast({
        variant: "destructive",
        title: "Re-analysis failed",
        description: json.error ?? "Try again.",
      })
      return
    }
    const json = await res.json()
    const a = json.analysis as Analysis
    setAnalysis(a)
    setPerPage((json.per_page ?? []) as PageSummary[])
    // Default: include only fields whose label looks NEW.
    setIncluded(
      a.fields.map((f) => !existingLabels.has(f.label.toLowerCase().trim())),
    )
    setOpen(true)
  }

  async function handleMerge() {
    if (!analysis) return
    const toMerge = analysis.fields.filter((_, i) => included[i])
    if (toMerge.length === 0) {
      toast({
        variant: "destructive",
        title: "Nothing selected",
        description: "Check at least one field to merge.",
      })
      return
    }

    setMerging(true)
    const existingIds = new Set(existingFields.map((f) => f.id))
    const newSchemaFields = [...existingFields]
    const newMapping: ExistingMapping = { ...existingMapping }

    for (const f of toMerge) {
      const id = slugifyId(f.label, existingIds)
      existingIds.add(id)
      newSchemaFields.push({
        id,
        label: f.label,
        semantic_type: f.semantic_type,
        data_source: f.data_source,
        required: f.required,
        period_specific:
          f.semantic_type === "period_month" ||
          f.semantic_type === "period_year",
      })
      // AI top-down %s → pdf-lib bottom-up baseline-y (mirrors upload-flow).
      const pos = f.approximate_position
      const widthPdf = pos
        ? Math.max(20, pos.width_pct * dimensions.width)
        : 100
      const heightPdf = pos
        ? Math.max(10, pos.height_pct * dimensions.height)
        : 12
      const x = pos ? pos.x_pct * dimensions.width : 50
      const boxTop = pos
        ? dimensions.height - pos.y_pct * dimensions.height
        : dimensions.height - 100
      const baselineY = boxTop - heightPdf + 1
      newMapping[id] = {
        page: f.page,
        x,
        y: baselineY,
        width: widthPdf,
        height: heightPdf,
        size: 10,
      }
    }

    const res = await fetch(
      `/api/forms/templates/${encodeURIComponent(formCode)}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          field_schema: {
            form_code: formCode,
            form_name: formName,
            agency,
            fields: newSchemaFields,
          },
          field_mapping: newMapping,
        }),
      },
    )
    setMerging(false)
    if (!res.ok) {
      const json = await res.json().catch(() => ({}))
      toast({
        variant: "destructive",
        title: "Merge failed",
        description: json.error ?? "Try again.",
      })
      return
    }
    toast({
      variant: "success",
      title: "Merged",
      description: `${toMerge.length} field${toMerge.length === 1 ? "" : "s"} added.`,
    })
    setOpen(false)
    setAnalysis(null)
    router.refresh()
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={handleReanalyze}
        disabled={analyzing || merging}
        className="gap-2"
      >
        {analyzing ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Sparkles className="size-4" />
        )}
        Re-analyze with AI
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="inline-flex items-center gap-2">
              <Sparkles className="size-4 text-primary" />
              AI suggestions vs current schema
            </DialogTitle>
            <DialogDescription>
              {analysis && (
                <>
                  Found {analysis.fields.length} field
                  {analysis.fields.length === 1 ? "" : "s"} across{" "}
                  {perPage.length} page{perPage.length === 1 ? "" : "s"}.
                  Likely-duplicate labels are pre-unchecked.
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          {analysis && (
            <div className="overflow-auto -mx-1 px-1 flex-1">
              <table className="w-full text-xs">
                <thead className="bg-muted/40 text-muted-foreground sticky top-0">
                  <tr>
                    <th className="w-10 px-2 py-2">
                      <input
                        type="checkbox"
                        checked={
                          included.length > 0 &&
                          included.every((v) => v)
                        }
                        onChange={(e) =>
                          setIncluded(
                            analysis.fields.map(() => e.target.checked),
                          )
                        }
                        className="size-3.5"
                      />
                    </th>
                    <th className="text-left px-3 py-2 font-medium">Label</th>
                    <th className="text-left px-3 py-2 font-medium w-12">
                      Page
                    </th>
                    <th className="text-left px-3 py-2 font-medium w-32">
                      Semantic
                    </th>
                    <th className="text-left px-3 py-2 font-medium w-32">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {analysis.fields.map((f, i) => {
                    const dup = existingLabels.has(
                      f.label.toLowerCase().trim(),
                    )
                    return (
                      <tr
                        key={i}
                        className={cn(
                          "border-t",
                          dup && "bg-amber-50/30 dark:bg-amber-950/10",
                        )}
                      >
                        <td className="px-2 py-2 align-top text-center">
                          <input
                            type="checkbox"
                            checked={included[i] ?? false}
                            onChange={(e) =>
                              setIncluded((prev) => {
                                const next = [...prev]
                                next[i] = e.target.checked
                                return next
                              })
                            }
                            className="size-3.5 mt-1"
                          />
                        </td>
                        <td className="px-3 py-2 align-top">
                          {f.label}
                          {f.notes && (
                            <div className="text-[10px] text-muted-foreground mt-0.5">
                              {f.notes}
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-2 align-top font-mono text-[11px] text-muted-foreground">
                          P{f.page}
                        </td>
                        <td className="px-3 py-2 align-top font-mono text-[11px] text-muted-foreground">
                          {f.semantic_type}
                        </td>
                        <td className="px-3 py-2 align-top text-[11px]">
                          {dup ? (
                            <span className="text-amber-700 dark:text-amber-400">
                              Duplicate label
                            </span>
                          ) : (
                            <span className="text-green-700 dark:text-green-400">
                              New
                            </span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                  {analysis.fields.length === 0 && (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-3 py-6 text-center text-muted-foreground"
                      >
                        AI didn&apos;t find any fields on this PDF.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          <DialogFooter className="gap-2">
            <DialogClose asChild>
              <Button variant="outline" disabled={merging}>
                Cancel
              </Button>
            </DialogClose>
            <Button
              onClick={handleMerge}
              disabled={
                merging || !analysis || included.filter(Boolean).length === 0
              }
              className="gap-2"
            >
              {merging ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <CheckCircle2 className="size-4" />
              )}
              Merge {included.filter(Boolean).length} selected
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
