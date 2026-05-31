"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/db/client"
import { Button } from "@/components/ui/button"
import { Download, FileText, Loader2, RotateCcw } from "lucide-react"

export function SubmissionActions({
  submissionId,
  outputPdfPath,
}: {
  submissionId: string
  outputPdfPath: string | null
}) {
  const router = useRouter()
  const [busy, setBusy] = useState<"generate" | "download" | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function generate() {
    setBusy("generate")
    setError(null)
    const res = await fetch(`/api/submissions/${submissionId}/generate-pdf`, {
      method: "POST",
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) {
      setError(json.error || "Generate failed")
      setBusy(null)
      setTimeout(() => setError(null), 5000)
      return
    }
    router.refresh()
    setBusy(null)
  }

  async function download() {
    if (!outputPdfPath) return
    setBusy("download")
    setError(null)
    const supabase = createClient()
    const { data, error: signedError } = await supabase.storage
      .from("documents")
      .createSignedUrl(outputPdfPath, 60)
    if (data?.signedUrl) {
      window.open(data.signedUrl, "_blank")
    } else if (signedError) {
      setError(signedError.message)
      setTimeout(() => setError(null), 5000)
    }
    setBusy(null)
  }

  if (!outputPdfPath) {
    return (
      <div className="flex flex-col items-end gap-1">
        <Button onClick={generate} disabled={busy !== null} size="sm" className="gap-2">
          {busy === "generate" ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <FileText className="size-4" />
          )}
          Generate PDF
        </Button>
        {error && <span className="text-xs text-destructive">{error}</span>}
      </div>
    )
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-1">
        <Button onClick={download} disabled={busy !== null} size="sm" className="gap-2">
          {busy === "download" ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Download className="size-4" />
          )}
          Download PDF
        </Button>
        <Button
          onClick={generate}
          disabled={busy !== null}
          variant="ghost"
          size="icon"
          title="Re-generate"
        >
          {busy === "generate" ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <RotateCcw className="size-4" />
          )}
        </Button>
      </div>
      {error && <span className="text-xs text-destructive">{error}</span>}
    </div>
  )
}
