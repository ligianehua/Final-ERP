"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { FileCheck, Loader2, Upload, Sparkles, X } from "lucide-react"
import { cn } from "@/lib/utils"

type Result = {
  form_code: string
  form_name: string
  agency: string
  confidence: number
  reasoning: string
}

const ACCEPT = ".jpg,.jpeg,.png"
const MAX_BYTES = 10 * 1024 * 1024

export function FormRecognizer() {
  const [file, setFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<Result | null>(null)
  const [error, setError] = useState<string | null>(null)

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null
    setError(null)
    setResult(null)
    if (!f) {
      setFile(null)
      setPreviewUrl(null)
      return
    }
    if (f.size > MAX_BYTES) {
      setError("File is too large (max 10 MB).")
      return
    }
    setFile(f)
    setPreviewUrl(URL.createObjectURL(f))
  }

  function reset() {
    setFile(null)
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl(null)
    setResult(null)
    setError(null)
  }

  async function handleRecognize() {
    if (!file) return
    setLoading(true)
    setError(null)
    setResult(null)

    const fd = new FormData()
    fd.append("file", file)

    const res = await fetch("/api/forms/recognize", { method: "POST", body: fd })
    const json = await res.json().catch(() => ({}))

    if (!res.ok) {
      setError(json.error || "Recognition failed.")
      setLoading(false)
      return
    }

    setResult(json.result)
    setLoading(false)
  }

  return (
    <div className="space-y-6">
      {/* Upload zone */}
      {!previewUrl ? (
        <label
          htmlFor="form-file"
          className="block border-2 border-dashed border-border rounded-lg p-12 text-center cursor-pointer hover:bg-secondary/30 transition-colors"
        >
          <Upload className="size-8 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm font-medium text-foreground mb-1">
            Click to upload a form photo
          </p>
          <p className="text-xs text-muted-foreground">JPG or PNG, max 10 MB</p>
          <input
            id="form-file"
            type="file"
            accept={ACCEPT}
            onChange={onFileChange}
            className="sr-only"
          />
        </label>
      ) : (
        <div className="flex flex-col md:flex-row gap-6">
          <div className="flex-1 relative">
            <img
              src={previewUrl}
              alt="form preview"
              className="w-full rounded-lg border border-border max-h-[500px] object-contain bg-secondary/30"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={reset}
              className="absolute top-2 right-2 gap-1"
            >
              <X className="size-4" />
              Remove
            </Button>
          </div>

          <div className="md:w-80 space-y-4">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Selected file</p>
              <p className="text-sm font-medium truncate">{file?.name}</p>
              <p className="text-xs text-muted-foreground">
                {file ? (file.size / 1024 / 1024).toFixed(2) : 0} MB
              </p>
            </div>

            {!result && (
              <Button
                onClick={handleRecognize}
                disabled={loading}
                className="w-full gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Recognizing...
                  </>
                ) : (
                  <>
                    <Sparkles className="size-4" />
                    Recognize form
                  </>
                )}
              </Button>
            )}

            {error && (
              <p className="text-sm text-destructive border border-destructive/30 rounded-md p-3">
                {error}
              </p>
            )}

            {result && <ResultCard result={result} />}
          </div>
        </div>
      )}
    </div>
  )
}

function ResultCard({ result }: { result: Result }) {
  const isUnknown = result.form_code === "UNKNOWN"
  const confidence = Math.round(result.confidence * 100)
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start gap-3">
          <div
            className={cn(
              "size-10 rounded-lg flex items-center justify-center shrink-0",
              isUnknown ? "bg-muted" : "bg-foreground text-background"
            )}
          >
            <FileCheck className="size-5" />
          </div>
          <div className="min-w-0">
            <CardTitle className="text-base">{result.form_name}</CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              {result.agency} · {result.form_code}
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-muted-foreground">Confidence</span>
            <span className="text-xs font-medium">{confidence}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
            <div
              className={cn(
                "h-full rounded-full transition-all",
                confidence >= 80
                  ? "bg-green-600"
                  : confidence >= 60
                    ? "bg-yellow-500"
                    : "bg-destructive"
              )}
              style={{ width: `${confidence}%` }}
            />
          </div>
        </div>
        <div>
          <p className="text-xs text-muted-foreground mb-1">AI reasoning</p>
          <p className="text-sm leading-relaxed">{result.reasoning}</p>
        </div>
        {isUnknown && (
          <p className="text-xs text-muted-foreground italic">
            Quill couldn&apos;t identify this form. Currently supports 5 forms — see list above.
          </p>
        )}
      </CardContent>
    </Card>
  )
}
