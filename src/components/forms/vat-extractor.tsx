"use client"

import { useState } from "react"
import {
  AlertCircle,
  Check,
  FileUp,
  Loader2,
  Receipt,
  Sigma,
  Sparkles,
  Trash2,
  Upload,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type SummaryExtraction = {
  gross_sales: string | null
  output_tax: string | null
  input_tax: string | null
  vat_payable: string | null
  period: string | null
  confidence: number
  reasoning: string
}

type ReceiptExtraction = {
  vendor_name: string | null
  vendor_tin: string | null
  date: string | null
  vatable_amount: string | null
  vat_amount: string | null
  total_amount: string | null
  confidence: number
}

type AppliedFields = Partial<
  Pick<SummaryExtraction, "gross_sales" | "output_tax" | "input_tax" | "vat_payable">
>

type Props = {
  /** Apply extracted values to the form. Caller wires this to setVal. */
  onApply: (fields: AppliedFields) => void
}

type Tab = "summary" | "receipts"

export function VATExtractor({ onApply }: Props) {
  const [tab, setTab] = useState<Tab>("summary")

  return (
    <div className="rounded-md border bg-card">
      <div className="flex items-center gap-2 p-3 border-b">
        <Sparkles className="size-4 text-primary" />
        <div className="flex-1">
          <p className="text-sm font-medium">Auto-fill amounts from a document</p>
          <p className="text-xs text-muted-foreground">
            Upload a monthly summary, or drop individual receipts and we&apos;ll
            sum the input VAT for you.
          </p>
        </div>
      </div>

      <div className="inline-flex border-b w-full">
        <TabButton active={tab === "summary"} onClick={() => setTab("summary")}>
          <FileUp className="size-3.5" /> Monthly summary
        </TabButton>
        <TabButton active={tab === "receipts"} onClick={() => setTab("receipts")}>
          <Receipt className="size-3.5" /> OR receipts
        </TabButton>
      </div>

      <div className="p-4">
        {tab === "summary" ? (
          <SummaryPanel onApply={onApply} />
        ) : (
          <ReceiptsPanel onApply={onApply} />
        )}
      </div>
    </div>
  )
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 px-4 py-2 text-xs transition-colors",
        active
          ? "border-b-2 border-foreground text-foreground -mb-px"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  )
}

function SummaryPanel({ onApply }: { onApply: (fields: AppliedFields) => void }) {
  const [state, setState] = useState<
    | { phase: "idle" }
    | { phase: "uploading"; fileName: string }
    | { phase: "done"; fileName: string; extracted: SummaryExtraction }
    | { phase: "error"; message: string }
  >({ phase: "idle" })

  async function handleFile(file: File) {
    setState({ phase: "uploading", fileName: file.name })
    const fd = new FormData()
    fd.append("file", file)
    const res = await fetch("/api/forms/extract/vat-summary", {
      method: "POST",
      body: fd,
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) {
      setState({ phase: "error", message: json.error ?? "Extraction failed" })
      return
    }
    setState({ phase: "done", fileName: file.name, extracted: json.extracted })
  }

  function apply() {
    if (state.phase !== "done") return
    const ex = state.extracted
    const fields: AppliedFields = {}
    if (ex.gross_sales) fields.gross_sales = formatAmountForInput(ex.gross_sales)
    if (ex.output_tax) fields.output_tax = formatAmountForInput(ex.output_tax)
    if (ex.input_tax) fields.input_tax = formatAmountForInput(ex.input_tax)
    if (ex.vat_payable) fields.vat_payable = formatAmountForInput(ex.vat_payable)
    onApply(fields)
    setState({ phase: "idle" })
  }

  return (
    <div className="space-y-3">
      {state.phase === "idle" && (
        <DropZone
          accept=".xls,.xlsx,.csv,.pdf,.doc,.docx,.odt,.ods,.png,.jpg,.jpeg,.html,.txt"
          onFile={handleFile}
          hint="One file — Excel / PDF / image / Word"
        />
      )}

      {state.phase === "uploading" && (
        <div className="rounded-md border bg-muted/30 p-4 flex items-center gap-3">
          <Loader2 className="size-4 animate-spin" />
          <p className="text-sm">
            Extracting from <span className="font-medium">{state.fileName}</span>…
          </p>
        </div>
      )}

      {state.phase === "error" && (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 p-4 flex items-start gap-3">
          <AlertCircle className="size-4 text-destructive mt-0.5" />
          <div className="flex-1 text-sm">
            <p className="text-destructive">{state.message}</p>
          </div>
          <button
            type="button"
            onClick={() => setState({ phase: "idle" })}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Try again
          </button>
        </div>
      )}

      {state.phase === "done" && (
        <div className="rounded-md border bg-muted/20 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm">
              <Check className="size-4 text-green-700" />
              <span className="font-medium">{state.fileName}</span>
              <ConfidenceBadge value={state.extracted.confidence} />
            </div>
            <button
              type="button"
              onClick={() => setState({ phase: "idle" })}
              className="text-muted-foreground hover:text-foreground"
              title="Remove and upload another"
            >
              <X className="size-4" />
            </button>
          </div>

          <ExtractedGrid extracted={state.extracted} />
          {state.extracted.reasoning && (
            <p className="text-xs text-muted-foreground italic">
              {state.extracted.reasoning}
            </p>
          )}

          <div className="flex justify-end">
            <Button onClick={apply} size="sm" className="gap-2">
              <Sparkles className="size-4" />
              Apply to form
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

function ExtractedGrid({ extracted }: { extracted: SummaryExtraction }) {
  const rows: [string, string | null][] = [
    ["Gross Sales", extracted.gross_sales],
    ["Output Tax (12%)", extracted.output_tax],
    ["Input Tax", extracted.input_tax],
    ["VAT Payable", extracted.vat_payable],
  ]
  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
      {rows.map(([label, value]) => (
        <div key={label} className="flex items-baseline justify-between gap-3">
          <dt className="text-muted-foreground">{label}</dt>
          <dd className={cn("font-mono tabular-nums", !value && "text-muted-foreground/60")}>
            {value ? `₱ ${formatAmountForInput(value)}` : "—"}
          </dd>
        </div>
      ))}
    </dl>
  )
}

type ReceiptItem = {
  id: string
  file: File
  state: "extracting" | "done" | "error"
  extracted?: ReceiptExtraction
  error?: string
}

function ReceiptsPanel({ onApply }: { onApply: (fields: AppliedFields) => void }) {
  const [items, setItems] = useState<ReceiptItem[]>([])

  async function handleFiles(files: File[]) {
    const newItems: ReceiptItem[] = files.map((f) => ({
      id: crypto.randomUUID(),
      file: f,
      state: "extracting",
    }))
    setItems((prev) => [...prev, ...newItems])

    // Process sequentially — keeps the AI gateway happy and the UI legible.
    for (const item of newItems) {
      const fd = new FormData()
      fd.append("file", item.file)
      const res = await fetch("/api/forms/extract/vat-receipt", {
        method: "POST",
        body: fd,
      })
      const json = await res.json().catch(() => ({}))
      setItems((prev) =>
        prev.map((x) =>
          x.id === item.id
            ? res.ok
              ? { ...x, state: "done", extracted: json.extracted }
              : {
                  ...x,
                  state: "error",
                  error: json.error ?? "Extraction failed",
                }
            : x,
        ),
      )
    }
  }

  function removeItem(id: string) {
    setItems((prev) => prev.filter((x) => x.id !== id))
  }

  const totalVAT = items.reduce((sum, x) => {
    const n = parseAmount(x.extracted?.vat_amount)
    return sum + (n ?? 0)
  }, 0)
  const totalVatable = items.reduce((sum, x) => {
    const n = parseAmount(x.extracted?.vatable_amount)
    return sum + (n ?? 0)
  }, 0)
  const doneCount = items.filter((x) => x.state === "done").length

  function applyTotal() {
    if (totalVAT <= 0) return
    onApply({ input_tax: formatAmount(totalVAT) })
  }

  return (
    <div className="space-y-3">
      <DropZone
        accept=".jpg,.jpeg,.png,.pdf"
        multiple
        onFiles={handleFiles}
        hint="Drop one or many receipts — JPG / PNG / PDF"
      />

      {items.length > 0 && (
        <div className="rounded-md border overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-muted/40 text-muted-foreground">
              <tr>
                <th className="text-left px-3 py-2 font-medium">File</th>
                <th className="text-left px-3 py-2 font-medium">Vendor</th>
                <th className="text-left px-3 py-2 font-medium">Date</th>
                <th className="text-right px-3 py-2 font-medium">Vatable</th>
                <th className="text-right px-3 py-2 font-medium">VAT</th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody>
              {items.map((x) => (
                <ReceiptRow key={x.id} item={x} onRemove={() => removeItem(x.id)} />
              ))}
            </tbody>
            <tfoot className="bg-muted/40 font-medium">
              <tr>
                <td className="px-3 py-2" colSpan={3}>
                  <span className="inline-flex items-center gap-2">
                    <Sigma className="size-3.5" />
                    Total ({doneCount} {doneCount === 1 ? "receipt" : "receipts"})
                  </span>
                </td>
                <td className="px-3 py-2 text-right font-mono tabular-nums">
                  ₱ {formatAmount(totalVatable)}
                </td>
                <td className="px-3 py-2 text-right font-mono tabular-nums">
                  ₱ {formatAmount(totalVAT)}
                </td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {items.length > 0 && (
        <div className="flex justify-end">
          <Button
            onClick={applyTotal}
            size="sm"
            className="gap-2"
            disabled={totalVAT <= 0}
          >
            <Sparkles className="size-4" />
            Apply ₱ {formatAmount(totalVAT)} to Input Tax
          </Button>
        </div>
      )}
    </div>
  )
}

function ReceiptRow({
  item,
  onRemove,
}: {
  item: ReceiptItem
  onRemove: () => void
}) {
  if (item.state === "extracting") {
    return (
      <tr className="border-t">
        <td className="px-3 py-2 truncate max-w-[180px]">{item.file.name}</td>
        <td colSpan={4} className="px-3 py-2 text-muted-foreground">
          <span className="inline-flex items-center gap-2">
            <Loader2 className="size-3 animate-spin" />
            Extracting…
          </span>
        </td>
        <td />
      </tr>
    )
  }
  if (item.state === "error") {
    return (
      <tr className="border-t bg-destructive/5">
        <td className="px-3 py-2 truncate max-w-[180px]">{item.file.name}</td>
        <td colSpan={4} className="px-3 py-2 text-destructive">
          {item.error}
        </td>
        <td className="px-2">
          <button
            type="button"
            onClick={onRemove}
            className="text-muted-foreground hover:text-foreground"
          >
            <Trash2 className="size-3.5" />
          </button>
        </td>
      </tr>
    )
  }
  const ex = item.extracted!
  return (
    <tr className="border-t">
      <td className="px-3 py-2 truncate max-w-[180px]" title={item.file.name}>
        {item.file.name}
      </td>
      <td className="px-3 py-2 truncate max-w-[160px]">
        {ex.vendor_name ?? <span className="text-muted-foreground">—</span>}
      </td>
      <td className="px-3 py-2 whitespace-nowrap">
        {ex.date ?? <span className="text-muted-foreground">—</span>}
      </td>
      <td className="px-3 py-2 text-right font-mono tabular-nums">
        {ex.vatable_amount ? `₱ ${formatAmountForInput(ex.vatable_amount)}` : "—"}
      </td>
      <td className="px-3 py-2 text-right font-mono tabular-nums">
        {ex.vat_amount ? `₱ ${formatAmountForInput(ex.vat_amount)}` : "—"}
      </td>
      <td className="px-2">
        <button
          type="button"
          onClick={onRemove}
          title="Remove from sum"
          className="text-muted-foreground hover:text-foreground"
        >
          <Trash2 className="size-3.5" />
        </button>
      </td>
    </tr>
  )
}

function DropZone(
  props:
    | {
        accept: string
        multiple?: false
        onFile: (file: File) => void
        hint: string
      }
    | {
        accept: string
        multiple: true
        onFiles: (files: File[]) => void
        hint: string
      },
) {
  const [dragging, setDragging] = useState(false)

  function dispatch(files: FileList | null) {
    if (!files || files.length === 0) return
    if (props.multiple) props.onFiles(Array.from(files))
    else props.onFile(files[0])
  }

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
        dispatch(e.dataTransfer.files)
      }}
      className={cn(
        "flex flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed py-8 px-4 cursor-pointer transition-colors",
        dragging
          ? "border-foreground bg-muted/60"
          : "border-border bg-muted/20 hover:bg-muted/40",
      )}
    >
      <Upload className="size-5 text-muted-foreground" />
      <p className="text-sm font-medium">Drop or click to upload</p>
      <p className="text-xs text-muted-foreground">{props.hint}</p>
      <input
        type="file"
        accept={props.accept}
        multiple={props.multiple ?? false}
        onChange={(e) => dispatch(e.target.files)}
        className="hidden"
      />
    </label>
  )
}

function ConfidenceBadge({ value }: { value: number }) {
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

/* Number helpers — local copies so this component stays independent. */

function parseAmount(s: string | undefined | null): number | null {
  if (!s || s.trim() === "") return null
  const n = Number(s.replace(/[,\s₱]/g, ""))
  return Number.isFinite(n) ? n : null
}

function formatAmount(n: number): string {
  return n.toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

/** Display amounts how the form inputs format them (en-PH thousands). */
function formatAmountForInput(raw: string): string {
  const n = parseAmount(raw)
  return n === null ? raw : formatAmount(n)
}
