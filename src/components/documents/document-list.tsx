"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/db/client"
import { Button } from "@/components/ui/button"
import { FileText, Download, Trash2, Loader2 } from "lucide-react"
import {
  DOCUMENT_FOLDER_LABELS,
  DOCUMENT_TYPE_LABELS,
  type DocumentFolderValue,
  type DocumentTypeValue,
} from "@/lib/validations/document"

type DocRow = {
  id: string
  document_type: DocumentTypeValue
  folder: DocumentFolderValue
  file_path: string
  file_name: string
  file_size: number | null
  created_at: string
}

export function DocumentList({ documents }: { documents: DocRow[] }) {
  if (documents.length === 0) {
    return (
      <div className="border border-dashed border-border rounded-lg p-8 text-center">
        <FileText className="size-6 text-muted-foreground mx-auto mb-2" />
        <p className="text-sm text-muted-foreground">No documents yet. Upload one to get started.</p>
      </div>
    )
  }

  return (
    <ul className="divide-y divide-border border border-border rounded-lg">
      {documents.map((doc) => (
        <DocumentRow key={doc.id} doc={doc} />
      ))}
    </ul>
  )
}

function DocumentRow({ doc }: { doc: DocRow }) {
  const router = useRouter()
  const [busy, setBusy] = useState<"download" | "delete" | null>(null)

  async function download() {
    setBusy("download")
    const supabase = createClient()
    const { data, error } = await supabase.storage
      .from("documents")
      .createSignedUrl(doc.file_path, 60)
    if (data?.signedUrl) {
      window.open(data.signedUrl, "_blank")
    } else if (error) {
      alert(`Cannot open file: ${error.message}`)
    }
    setBusy(null)
  }

  async function remove() {
    if (!confirm(`Delete "${doc.file_name}"?`)) return
    setBusy("delete")
    const res = await fetch(`/api/documents/${doc.id}`, { method: "DELETE" })
    if (res.ok) {
      router.refresh()
    } else {
      setBusy(null)
      alert("Delete failed.")
    }
  }

  const sizeMb = doc.file_size ? (doc.file_size / 1024 / 1024).toFixed(2) : null

  return (
    <li className="flex items-center gap-3 p-3">
      <div className="size-10 rounded-md bg-secondary flex items-center justify-center shrink-0">
        <FileText className="size-5 text-foreground" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium truncate">{doc.file_name}</p>
        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
          <span>{DOCUMENT_TYPE_LABELS[doc.document_type]}</span>
          <span>·</span>
          <span>{DOCUMENT_FOLDER_LABELS[doc.folder]}</span>
          {sizeMb && (
            <>
              <span>·</span>
              <span>{sizeMb} MB</span>
            </>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <Button
          variant="ghost"
          size="icon"
          onClick={download}
          disabled={busy !== null}
          title="Open"
        >
          {busy === "download" ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={remove}
          disabled={busy !== null}
          title="Delete"
          className="text-destructive hover:text-destructive"
        >
          {busy === "delete" ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
        </Button>
      </div>
    </li>
  )
}
