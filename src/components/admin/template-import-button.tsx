"use client"

import { useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2, Upload } from "lucide-react"
import { Button } from "@/components/ui/button"
import { toast } from "@/components/ui/toaster"

export function TemplateImportButton() {
  const router = useRouter()
  const [uploading, setUploading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleFile(file: File) {
    setUploading(true)
    let text: string
    try {
      text = await file.text()
    } catch {
      toast({
        variant: "destructive",
        title: "Could not read file",
      })
      setUploading(false)
      return
    }
    let parsed: unknown
    try {
      parsed = JSON.parse(text)
    } catch {
      toast({
        variant: "destructive",
        title: "Not valid JSON",
        description: "Pick a .template.json file exported from Quill.",
      })
      setUploading(false)
      return
    }

    const res = await fetch("/api/forms/templates/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(parsed),
    })
    setUploading(false)
    const json = await res.json().catch(() => ({}))
    if (!res.ok) {
      toast({
        variant: "destructive",
        title: "Import failed",
        description: json.error ?? "Try again.",
      })
      return
    }

    if (json.bundle) {
      // Bulk import: stay on the catalog so the user can spot anything
      // that failed.
      const fails = (json.results ?? []).filter(
        (r: { ok: boolean }) => !r.ok,
      )
      toast({
        variant: fails.length === 0 ? "success" : "destructive",
        title: `Imported ${json.imported} of ${json.total}`,
        description:
          fails.length === 0
            ? "All templates added."
            : `Failed: ${fails
                .map(
                  (f: { form_code: string; error: string }) =>
                    `${f.form_code ?? "?"} (${f.error})`,
                )
                .join("; ")}`,
      })
      router.refresh()
      return
    }

    toast({
      variant: "success",
      title: `Imported ${json.form_code}`,
      description: json.pdf_uploaded
        ? `${json.pages_uploaded} page${json.pages_uploaded === 1 ? "" : "s"} rendered. Open the detail page to review.`
        : "Schema imported — use Replace PDF to attach the binary.",
    })
    router.push(`/admin/templates/${json.form_code}`)
    router.refresh()
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept=".json,application/json"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) handleFile(f)
          if (inputRef.current) inputRef.current.value = ""
        }}
        className="hidden"
      />
      <Button
        variant="outline"
        size="sm"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="gap-2 shrink-0"
      >
        {uploading ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Upload className="size-4" />
        )}
        Import JSON
      </Button>
    </>
  )
}
