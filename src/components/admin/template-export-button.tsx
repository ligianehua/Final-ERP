"use client"

import { useState } from "react"
import { Download, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { toast } from "@/components/ui/toaster"

type Props = {
  formCode: string
}

export function TemplateExportButton({ formCode }: Props) {
  const [exporting, setExporting] = useState(false)

  async function handleExport() {
    setExporting(true)
    try {
      const res = await fetch(
        `/api/forms/templates/${encodeURIComponent(formCode)}/export`,
        { method: "GET" },
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
      // Stream straight into a Blob so the PDF base64 doesn't have to
      // round-trip through a JS string.
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `${formCode}.template.json`
      a.click()
      URL.revokeObjectURL(url)
      toast({
        variant: "success",
        title: "Exported",
        description: `${formCode}.template.json downloaded.`,
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
      className="gap-2"
    >
      {exporting ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <Download className="size-4" />
      )}
      Export JSON
    </Button>
  )
}
