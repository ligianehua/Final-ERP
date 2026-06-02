"use client"

import { useRef, useState } from "react"
import { CheckCircle2, FileImage, Loader2, X } from "lucide-react"
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

type FieldMeta = {
  id: string
  label: string
}

type Props = {
  formCode: string
  fields: FieldMeta[]
  currentValues: Record<string, string>
  onApply: (updates: Record<string, string>) => void
}

type ExtractResponse = {
  values: Record<string, string | null>
  field_count: number
  hit_count: number
}

export function FormImagePrefill({
  formCode,
  fields,
  currentValues,
  onApply,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [result, setResult] = useState<ExtractResponse | null>(null)
  const [included, setIncluded] = useState<Record<string, boolean>>({})
  const [open, setOpen] = useState(false)

  const labelOf = new Map(fields.map((f) => [f.id, f.label]))

  function reset() {
    setResult(null)
    setIncluded({})
    if (inputRef.current) inputRef.current.value = ""
  }

  async function handleFile(file: File) {
    setUploading(true)
    const fd = new FormData()
    fd.append("file", file)
    fd.append("form_code", formCode)
    const res = await fetch("/api/forms/fill/extract", {
      method: "POST",
      body: fd,
    })
    setUploading(false)
    const json = await res.json().catch(() => ({}))
    if (!res.ok) {
      toast({
        variant: "destructive",
        title: "Extraction failed",
        description: json.error ?? "Try again.",
      })
      return
    }
    const data = json as ExtractResponse
    setResult(data)
    // Default: only include hits that DON'T overwrite something the
    // user already typed. Lets you supplement, not destroy work.
    const inc: Record<string, boolean> = {}
    for (const [id, value] of Object.entries(data.values)) {
      if (value === null) continue
      const existing = currentValues[id]?.trim() ?? ""
      inc[id] = existing === ""
    }
    setIncluded(inc)
    setOpen(true)
  }

  function handleApply() {
    if (!result) return
    const updates: Record<string, string> = {}
    for (const [id, val] of Object.entries(result.values)) {
      if (val === null) continue
      if (!included[id]) continue
      updates[id] = val
    }
    if (Object.keys(updates).length === 0) {
      toast({
        variant: "destructive",
        title: "Nothing selected",
        description: "Tick at least one extracted value first.",
      })
      return
    }
    onApply(updates)
    toast({
      variant: "success",
      title: "Pre-filled",
      description: `${Object.keys(updates).length} field${Object.keys(updates).length === 1 ? "" : "s"} updated from the scan.`,
    })
    setOpen(false)
    reset()
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.png,.jpg,.jpeg,.webp"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) handleFile(f)
        }}
        className="hidden"
      />
      <Button
        variant="outline"
        size="sm"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="gap-2"
      >
        {uploading ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <FileImage className="size-4" />
        )}
        Prefill from scan
      </Button>

      <Dialog
        open={open}
        onOpenChange={(o) => {
          setOpen(o)
          if (!o) reset()
        }}
      >
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="inline-flex items-center gap-2">
              <FileImage className="size-4 text-primary" />
              Extracted from the scan
            </DialogTitle>
            <DialogDescription>
              {result && (
                <>
                  AI found {result.hit_count} of {result.field_count}{" "}
                  fields. Fields you&apos;ve already typed are unticked by
                  default — tick anything you want overwritten.
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          {result && (
            <div className="overflow-auto -mx-1 px-1 flex-1">
              <table className="w-full text-xs">
                <thead className="bg-muted/40 text-muted-foreground sticky top-0">
                  <tr>
                    <th className="w-10 px-2 py-2"></th>
                    <th className="text-left px-3 py-2 font-medium">Field</th>
                    <th className="text-left px-3 py-2 font-medium">
                      Current
                    </th>
                    <th className="text-left px-3 py-2 font-medium">
                      Extracted
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(result.values).map(([id, extracted]) => {
                    const cur = currentValues[id]?.trim() ?? ""
                    const willOverwrite =
                      cur !== "" && extracted !== null && cur !== extracted
                    return (
                      <tr
                        key={id}
                        className={cn(
                          "border-t",
                          extracted === null && "opacity-50",
                          willOverwrite &&
                            "bg-amber-50/30 dark:bg-amber-950/10",
                        )}
                      >
                        <td className="px-2 py-2 align-top text-center">
                          <input
                            type="checkbox"
                            checked={included[id] ?? false}
                            disabled={extracted === null}
                            onChange={(e) =>
                              setIncluded((prev) => ({
                                ...prev,
                                [id]: e.target.checked,
                              }))
                            }
                            className="size-3.5 mt-1"
                          />
                        </td>
                        <td className="px-3 py-2 align-top">
                          {labelOf.get(id) ?? id}
                          <div className="text-[10px] font-mono text-muted-foreground">
                            {id}
                          </div>
                        </td>
                        <td className="px-3 py-2 align-top text-muted-foreground">
                          {cur === "" ? (
                            <span className="italic">empty</span>
                          ) : (
                            cur
                          )}
                        </td>
                        <td className="px-3 py-2 align-top">
                          {extracted === null ? (
                            <span className="text-muted-foreground italic inline-flex items-center gap-1">
                              <X className="size-3" /> not found
                            </span>
                          ) : (
                            <span
                              className={cn(
                                willOverwrite &&
                                  "text-amber-800 dark:text-amber-300 font-medium",
                              )}
                            >
                              {extracted}
                            </span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          <DialogFooter className="gap-2">
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button
              onClick={handleApply}
              disabled={!result || Object.values(included).every((v) => !v)}
              className="gap-2"
            >
              <CheckCircle2 className="size-4" />
              Apply{" "}
              {result
                ? Object.values(included).filter(Boolean).length
                : 0}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
