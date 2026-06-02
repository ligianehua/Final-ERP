"use client"

import { useState } from "react"
import { Download, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { toast } from "@/components/ui/toaster"

type Props = {
  /** form_codes that have a DB row (so they have something to export). */
  exportableCodes: string[]
}

export function TemplateBulkExportButton({ exportableCodes }: Props) {
  const [exporting, setExporting] = useState(false)

  async function handleExport() {
    if (exportableCodes.length === 0) {
      toast({
        variant: "destructive",
        title: "Nothing to export",
        description:
          "Only DB-persisted templates can be bundled. Upload one first.",
      })
      return
    }
    setExporting(true)
    try {
      // Pass the explicit code list so we don't accidentally pull
      // code-only templates that don't have PNGs.
      const qs = new URLSearchParams({ codes: exportableCodes.join(",") })
      const res = await fetch(
        `/api/forms/templates/bulk-export?${qs.toString()}`,
      )
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        toast({
          variant: "destructive",
          title: "Export failed",
          description: json.error ?? "Try again.",
        })
        return
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      // Filename comes from Content-Disposition but browsers can ignore it
      // on programmatic downloads, so set one explicitly too.
      const stamp = new Date().toISOString().slice(0, 10)
      a.download = `quill-templates-${exportableCodes.length}-${stamp}.json`
      a.click()
      URL.revokeObjectURL(url)
      toast({
        variant: "success",
        title: "Bundle exported",
        description: `${exportableCodes.length} template${exportableCodes.length === 1 ? "" : "s"} packed into one JSON.`,
      })
    } finally {
      setExporting(false)
    }
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleExport}
      disabled={exporting}
      className="gap-2 shrink-0"
    >
      {exporting ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <Download className="size-4" />
      )}
      Export all
    </Button>
  )
}
