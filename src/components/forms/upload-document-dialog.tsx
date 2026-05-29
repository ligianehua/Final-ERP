"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/db/client"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Loader2, Upload, FileText } from "lucide-react"
import {
  DOCUMENT_FOLDER_LABELS,
  DOCUMENT_TYPE_DEFAULT_FOLDER,
  DOCUMENT_TYPE_LABELS,
  type DocumentFolderValue,
  type DocumentTypeValue,
} from "@/lib/validations/document"

type DocType = DocumentTypeValue
type DocFolder = DocumentFolderValue

const ACCEPT = ".pdf,.jpg,.jpeg,.png"
const MAX_BYTES = 10 * 1024 * 1024 // 10 MB

export function UploadDocumentDialog({ companyId }: { companyId: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [docType, setDocType] = useState<DocType>("BIR_2303")
  const [folder, setFolder] = useState<DocFolder>(DOCUMENT_TYPE_DEFAULT_FOLDER.BIR_2303)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function reset() {
    setFile(null)
    setDocType("BIR_2303")
    setFolder(DOCUMENT_TYPE_DEFAULT_FOLDER.BIR_2303)
    setError(null)
  }

  function onTypeChange(t: DocType) {
    setDocType(t)
    setFolder(DOCUMENT_TYPE_DEFAULT_FOLDER[t])
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null
    if (f && f.size > MAX_BYTES) {
      setError("File is too large (max 10 MB).")
      setFile(null)
      return
    }
    setError(null)
    setFile(f)
  }

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault()
    if (!file) return
    setLoading(true)
    setError(null)

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setError("Not signed in.")
      setLoading(false)
      return
    }

    const ext = file.name.split(".").pop() ?? "bin"
    const safeName = file.name.replace(/[^\w.\-]/g, "_")
    const objectKey = `${user.id}/${companyId}/${crypto.randomUUID()}-${safeName}`

    const { error: uploadError } = await supabase.storage
      .from("documents")
      .upload(objectKey, file, {
        contentType: file.type || `application/${ext}`,
        upsert: false,
      })

    if (uploadError) {
      setError(`Upload failed: ${uploadError.message}`)
      setLoading(false)
      return
    }

    const res = await fetch("/api/documents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        company_id: companyId,
        document_type: docType,
        folder,
        file_path: objectKey,
        file_name: file.name,
        file_size: file.size,
        mime_type: file.type || null,
      }),
    })

    if (!res.ok) {
      // Roll back the orphaned file
      await supabase.storage.from("documents").remove([objectKey])
      const data = await res.json().catch(() => ({}))
      setError(data.error || "Failed to save document.")
      setLoading(false)
      return
    }

    setOpen(false)
    reset()
    setLoading(false)
    router.refresh()
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o)
        if (!o) reset()
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm" className="gap-2">
          <Upload className="size-4" />
          Upload
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Upload document</DialogTitle>
          <DialogDescription>
            PDF or image, up to 10 MB. Filed to the right folder by document type.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleUpload} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="doc_type">Document type</Label>
            <select
              id="doc_type"
              value={docType}
              onChange={(e) => onTypeChange(e.target.value as DocType)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {Object.entries(DOCUMENT_TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="folder">Folder</Label>
            <select
              id="folder"
              value={folder}
              onChange={(e) => setFolder(e.target.value as DocFolder)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {Object.entries(DOCUMENT_FOLDER_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="file">File</Label>
            <label
              htmlFor="file"
              className="flex flex-col items-center justify-center gap-2 border border-dashed border-border rounded-md p-6 cursor-pointer hover:bg-secondary/50 transition-colors"
            >
              {file ? (
                <>
                  <FileText className="size-6 text-foreground" />
                  <span className="text-sm font-medium">{file.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {(file.size / 1024 / 1024).toFixed(2)} MB · click to change
                  </span>
                </>
              ) : (
                <>
                  <Upload className="size-6 text-muted-foreground" />
                  <span className="text-sm font-medium">Click to choose file</span>
                  <span className="text-xs text-muted-foreground">PDF, JPG, PNG · max 10 MB</span>
                </>
              )}
              <input
                id="file"
                type="file"
                accept={ACCEPT}
                onChange={onFileChange}
                className="sr-only"
              />
            </label>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <Button type="submit" disabled={loading || !file} className="gap-2">
              {loading && <Loader2 className="size-4 animate-spin" />}
              Upload
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
