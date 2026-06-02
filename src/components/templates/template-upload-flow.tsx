"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  Sparkles,
  Upload,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { toast } from "@/components/ui/toaster"

type ApproxPos = {
  x_pct: number
  y_pct: number
  width_pct: number
  height_pct: number
} | null

type AnalysisField = {
  label: string
  semantic_type: string
  data_source: string | null
  required: boolean
  approximate_position: ApproxPos
  notes: string | null
}

type Analysis = {
  issuer: {
    name: string
    type: "government" | "bank" | "lgu" | "other"
    abbreviation: string | null
  }
  form_name: string
  form_code_suggested: string
  fields: AnalysisField[]
  confidence: number
  reasoning: string
}

type Dimensions = { width: number; height: number; pageCount: number }

type Stage =
  | { kind: "idle" }
  | { kind: "analyzing"; fileName: string }
  | {
      kind: "review"
      fileName: string
      analysis: Analysis
      dimensions: Dimensions
      pdfBase64: string
    }
  | { kind: "saving" }
  | { kind: "error"; message: string }

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

function slugify(label: string): string {
  return (
    label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 40) || "field"
  )
}

export function TemplateUploadFlow() {
  const router = useRouter()
  const [stage, setStage] = useState<Stage>({ kind: "idle" })
  // Review-stage edit state lives outside Stage so React doesn't rerender the
  // whole table on every keystroke.
  const [formCode, setFormCode] = useState("")
  const [formName, setFormName] = useState("")
  const [agency, setAgency] = useState("")
  const [frequency, setFrequency] = useState<string>("")
  const [included, setIncluded] = useState<boolean[]>([])

  async function handleUpload(file: File) {
    setStage({ kind: "analyzing", fileName: file.name })
    const fd = new FormData()
    fd.append("file", file)
    const res = await fetch("/api/templates/analyze", {
      method: "POST",
      body: fd,
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) {
      setStage({ kind: "error", message: json.error ?? "Analysis failed" })
      return
    }
    const analysis = json.analysis as Analysis
    setFormCode(analysis.form_code_suggested)
    setFormName(analysis.form_name)
    setAgency(analysis.issuer.name)
    setFrequency("")
    setIncluded(analysis.fields.map(() => true))
    setStage({
      kind: "review",
      fileName: file.name,
      analysis,
      dimensions: json.dimensions,
      pdfBase64: json.pdf_base64,
    })
  }

  async function handleSave() {
    if (stage.kind !== "review") return
    if (!formCode.match(/^[A-Z0-9_]+$/)) {
      toast({
        variant: "destructive",
        title: "Bad form code",
        description: "Use UPPERCASE letters, digits, and underscores only.",
      })
      return
    }

    // Capture before flipping into "saving" — we need the analysis on the
    // error path to restore the review screen with the user's edits intact.
    const review = stage
    setStage({ kind: "saving" })

    const { analysis, dimensions, pdfBase64 } = review

    // AI positions are top-down %s; convert to pdf-lib bottom-up baselines.
    const fields = analysis.fields
      .map((f, i) => ({ f, i }))
      .filter(({ i }) => included[i])
      .map(({ f }, idx) => {
        const pos = f.approximate_position
        const widthPdf = pos
          ? Math.max(20, pos.width_pct * dimensions.width)
          : 100
        const heightPdf = pos
          ? Math.max(10, pos.height_pct * dimensions.height)
          : 12
        const x = pos ? pos.x_pct * dimensions.width : 50
        // Box top in PDF coords (bottom-up):
        const boxTop = pos
          ? dimensions.height - pos.y_pct * dimensions.height
          : dimensions.height - 100 - idx * 20
        // Baseline ≈ box bottom + 1pt (mirrors render-on-template logic):
        const baselineY = boxTop - heightPdf + 1
        return {
          id: slugify(f.label) + (idx === 0 ? "" : `_${idx}`),
          label: f.label,
          semantic_type: f.semantic_type,
          data_source: f.data_source,
          required: f.required,
          page: 1,
          x,
          y: baselineY,
          width: widthPdf,
          height: heightPdf,
          size: 10,
        }
      })

    const res = await fetch("/api/templates/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        form_code: formCode,
        form_name: formName,
        agency,
        frequency: frequency || undefined,
        pdf_base64: pdfBase64,
        dimensions,
        fields,
      }),
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) {
      toast({
        variant: "destructive",
        title: "Save failed",
        description: json.error ?? "Try again.",
      })
      setStage(review)
      return
    }
    toast({
      variant: "success",
      title: "Template saved",
      description: `${formCode} is live.`,
    })
    router.push(`/forms/fill?form_code=${encodeURIComponent(formCode)}`)
    router.refresh()
  }

  if (stage.kind === "idle") {
    return (
      <DropZone
        accept=".pdf,.xls,.xlsx,.doc,.docx,.odt,.ods,.png,.jpg,.jpeg"
        onFile={handleUpload}
      />
    )
  }

  if (stage.kind === "analyzing") {
    return (
      <Card>
        <CardContent className="p-8 flex flex-col items-center gap-3 text-center">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
          <p className="text-sm font-medium">Analyzing {stage.fileName}</p>
          <p className="text-xs text-muted-foreground max-w-sm">
            Converting to PDF, rendering page 1, asking the vision model to
            identify the issuer and fields. This usually takes 15-30 seconds.
          </p>
        </CardContent>
      </Card>
    )
  }

  if (stage.kind === "error") {
    return (
      <Card>
        <CardContent className="p-6 flex items-start gap-3">
          <AlertCircle className="size-5 text-destructive mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium text-destructive">
              Analysis failed
            </p>
            <p className="text-xs text-muted-foreground mt-1">{stage.message}</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setStage({ kind: "idle" })}
          >
            Try again
          </Button>
        </CardContent>
      </Card>
    )
  }

  if (stage.kind === "saving") {
    return (
      <Card>
        <CardContent className="p-8 flex flex-col items-center gap-3 text-center">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
          <p className="text-sm font-medium">Saving template…</p>
          <p className="text-xs text-muted-foreground">
            Uploading the PDF, rendering page images, indexing fields.
          </p>
        </CardContent>
      </Card>
    )
  }

  // Review stage
  const { analysis, dimensions } = stage
  const issuerSubtitle =
    analysis.issuer.abbreviation && analysis.issuer.abbreviation !== analysis.issuer.name
      ? `${analysis.issuer.abbreviation} · ${analysis.issuer.name}`
      : analysis.issuer.name

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base inline-flex items-center gap-2">
            <Sparkles className="size-4 text-primary" />
            Analysis
            <ConfidencePill value={analysis.confidence} />
          </CardTitle>
          <p className="text-xs text-muted-foreground">{analysis.reasoning}</p>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            <span className="font-medium text-foreground">{stage.fileName}</span>
            {" · "}
            {dimensions.pageCount} page{dimensions.pageCount === 1 ? "" : "s"}
            {" · "}
            {dimensions.width.toFixed(0)} × {dimensions.height.toFixed(0)} pt
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label htmlFor="form_code" className="text-xs">
                Form code
              </Label>
              <Input
                id="form_code"
                value={formCode}
                onChange={(e) => setFormCode(e.target.value.toUpperCase())}
                placeholder="BDO_ACCOUNT_OPENING"
                className="font-mono"
              />
            </div>
            <div>
              <Label htmlFor="agency" className="text-xs">
                Issuer
              </Label>
              <Input
                id="agency"
                value={agency}
                onChange={(e) => setAgency(e.target.value)}
                placeholder={issuerSubtitle}
              />
            </div>
            <div className="md:col-span-2">
              <Label htmlFor="form_name" className="text-xs">
                Form name
              </Label>
              <Input
                id="form_name"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="frequency" className="text-xs">
                Filing frequency (optional)
              </Label>
              <select
                id="frequency"
                value={frequency}
                onChange={(e) => setFrequency(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="">— None —</option>
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
                <option value="annual">Annual</option>
                <option value="per_payment">Per payment</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            Fields ({included.filter(Boolean).length} / {analysis.fields.length} included)
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Uncheck anything the AI flagged that isn&apos;t actually a field.
            Positions are first-pass — you&apos;ll drag-correct them in the
            WYSIWYG editor right after saving.
          </p>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-xs">
            <thead className="bg-muted/40 text-muted-foreground">
              <tr>
                <th className="w-10 px-3 py-2"></th>
                <th className="text-left px-3 py-2 font-medium">Label</th>
                <th className="text-left px-3 py-2 font-medium">Semantic</th>
                <th className="text-left px-3 py-2 font-medium">Archive source</th>
                <th className="text-center px-3 py-2 font-medium">Req</th>
              </tr>
            </thead>
            <tbody>
              {analysis.fields.map((f, i) => (
                <tr key={i} className="border-t">
                  <td className="px-3 py-2 align-top">
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
                      className="size-4"
                    />
                  </td>
                  <td className="px-3 py-2 align-top text-foreground">
                    {f.label}
                    {f.notes && (
                      <div className="text-[10px] text-muted-foreground mt-0.5">
                        {f.notes}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2 align-top font-mono text-[11px] text-muted-foreground">
                    {f.semantic_type}
                  </td>
                  <td className="px-3 py-2 align-top font-mono text-[11px] text-muted-foreground">
                    {f.data_source ?? "—"}
                  </td>
                  <td className="px-3 py-2 align-top text-center text-muted-foreground">
                    {f.required ? "•" : ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button
          variant="outline"
          onClick={() => setStage({ kind: "idle" })}
        >
          Discard
        </Button>
        <Button onClick={handleSave} className="gap-2">
          <CheckCircle2 className="size-4" />
          Save template
        </Button>
      </div>
    </div>
  )
}

function DropZone({
  accept,
  onFile,
}: {
  accept: string
  onFile: (file: File) => void
}) {
  const [dragging, setDragging] = useState(false)
  return (
    <label
      onDragOver={(e) => {
        e.preventDefault()
        setDragging(true)
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault()
        setDragging(false)
        const f = e.dataTransfer.files?.[0]
        if (f) onFile(f)
      }}
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed py-16 cursor-pointer transition-colors",
        dragging
          ? "border-foreground bg-muted/60"
          : "border-border bg-muted/20 hover:bg-muted/40",
      )}
    >
      <div className="size-12 rounded-full bg-background flex items-center justify-center">
        <Upload className="size-5 text-muted-foreground" />
      </div>
      <div className="text-center">
        <p className="text-sm font-medium">Drop a form or click to upload</p>
        <p className="text-xs text-muted-foreground mt-1">
          PDF / Excel / Word / image — any government or bank form
        </p>
      </div>
      <input
        type="file"
        accept={accept}
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) onFile(f)
        }}
        className="hidden"
      />
    </label>
  )
}

function ConfidencePill({ value }: { value: number }) {
  const pct = Math.round(value * 100)
  const cls =
    pct >= 80
      ? "bg-green-600/10 text-green-700 border-green-600/30"
      : pct >= 50
        ? "bg-amber-500/10 text-amber-700 border-amber-500/30"
        : "bg-destructive/10 text-destructive border-destructive/30"
  return (
    <span className={cn("text-[10px] border rounded px-1.5 py-0.5", cls)}>
      {pct}% confident
    </span>
  )
}
