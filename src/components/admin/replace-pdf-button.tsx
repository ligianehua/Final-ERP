"use client"

import { useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { AlertCircle, FileUp, Loader2 } from "lucide-react"
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
import { toast } from "@/components/ui/toaster"

type Props = {
  formCode: string
  currentPageCount: number
}

export function ReplacePdfButton({ formCode, currentPageCount }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  function reset() {
    setSelectedFile(null)
    if (inputRef.current) inputRef.current.value = ""
  }

  async function handleReplace() {
    if (!selectedFile) return
    setUploading(true)
    const fd = new FormData()
    fd.append("file", selectedFile)
    const res = await fetch(
      `/api/forms/templates/${encodeURIComponent(formCode)}/replace-pdf`,
      { method: "POST", body: fd },
    )
    const json = await res.json().catch(() => ({}))
    setUploading(false)
    if (!res.ok) {
      toast({
        variant: "destructive",
        title: "Replace failed",
        description: json.error ?? "Try again.",
      })
      return
    }
    const orphans = (json.orphan_field_ids ?? []) as string[]
    toast({
      variant: "success",
      title: "PDF replaced",
      description:
        orphans.length > 0
          ? `${json.pages_uploaded} pages re-rendered. ${orphans.length} field${orphans.length === 1 ? "" : "s"} lost their coordinates (page count shrank) — re-position them in the Layout panel.`
          : `${json.pages_uploaded} pages re-rendered. Page count: ${json.dimensions.pageCount}.`,
    })
    setOpen(false)
    reset()
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
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="gap-2"
      >
        <FileUp className="size-4" />
        Replace PDF
      </Button>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Replace the source PDF</DialogTitle>
          <DialogDescription>
            Upload a new version of the PDF for{" "}
            <span className="font-mono">{formCode}</span>. The field
            schema is kept exactly as-is — only the page images and PDF
            dimensions change.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,.doc,.docx,.odt,.ods,.xls,.xlsx,.png,.jpg,.jpeg"
            onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
            className="block w-full text-sm file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border file:border-input file:bg-background file:text-sm file:cursor-pointer hover:file:bg-muted"
          />
          {selectedFile && (
            <p className="text-xs text-muted-foreground">
              Selected:{" "}
              <span className="font-medium text-foreground">
                {selectedFile.name}
              </span>{" "}
              ({(selectedFile.size / 1024).toFixed(0)} KB)
            </p>
          )}

          <div className="flex items-start gap-2 rounded-md border bg-amber-50 dark:bg-amber-950/40 px-3 py-2 text-xs">
            <AlertCircle className="size-4 text-amber-700 dark:text-amber-300 mt-0.5 shrink-0" />
            <div className="text-amber-900 dark:text-amber-200">
              If the new PDF&apos;s layout shifted, existing field
              positions will be wrong. Re-check them in the Layout panel
              after replacing. Fields on pages past the new page count
              (current:{" "}
              <span className="font-mono">{currentPageCount}</span>) will
              lose their coordinates.
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <DialogClose asChild>
            <Button variant="outline" disabled={uploading}>
              Cancel
            </Button>
          </DialogClose>
          <Button
            onClick={handleReplace}
            disabled={!selectedFile || uploading}
            className="gap-2"
          >
            {uploading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <FileUp className="size-4" />
            )}
            Replace PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
