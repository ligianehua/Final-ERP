"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/db/client"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Download,
  FileText,
  Loader2,
  Pencil,
  RotateCcw,
  Trash2,
} from "lucide-react"
import { toast } from "@/components/ui/toaster"

type Props = {
  submissionId: string
  formCode: string
  formName: string
  outputPdfPath: string | null
}

export function SubmissionActions({
  submissionId,
  formCode,
  formName,
  outputPdfPath,
}: Props) {
  const router = useRouter()
  const [busy, setBusy] = useState<
    "generate" | "download" | "delete" | null
  >(null)

  async function generate() {
    setBusy("generate")
    const res = await fetch(`/api/submissions/${submissionId}/generate-pdf`, {
      method: "POST",
    })
    const json = await res.json().catch(() => ({}))
    setBusy(null)
    if (!res.ok) {
      toast({
        variant: "destructive",
        title: "Generate failed",
        description: json.error ?? "Couldn't render the PDF.",
      })
      return
    }
    toast({
      variant: "success",
      title: "PDF ready",
      description: "Click Download to get your file.",
    })
    router.refresh()
  }

  async function download() {
    if (!outputPdfPath) return
    setBusy("download")
    const supabase = createClient()
    const { data, error: signedError } = await supabase.storage
      .from("documents")
      .createSignedUrl(outputPdfPath, 60)
    setBusy(null)
    if (data?.signedUrl) {
      window.open(data.signedUrl, "_blank")
    } else if (signedError) {
      toast({
        variant: "destructive",
        title: "Download failed",
        description: signedError.message,
      })
    }
  }

  async function handleDelete() {
    setBusy("delete")
    const res = await fetch(`/api/submissions/${submissionId}`, {
      method: "DELETE",
    })
    if (!res.ok) {
      const json = await res.json().catch(() => ({}))
      setBusy(null)
      toast({
        variant: "destructive",
        title: "Delete failed",
        description: json.error ?? "Try again.",
      })
      return
    }
    toast({ variant: "success", title: "Submission deleted" })
    router.refresh()
    // busy stays "delete" until the row disappears on refresh
  }

  const editHref = `/forms/fill?form_code=${encodeURIComponent(
    formCode,
  )}&submission_id=${encodeURIComponent(submissionId)}`

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-1">
        {outputPdfPath ? (
          <>
            <Button
              onClick={download}
              disabled={busy !== null}
              size="sm"
              className="gap-2"
            >
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
          </>
        ) : (
          <Button
            onClick={generate}
            disabled={busy !== null}
            size="sm"
            className="gap-2"
          >
            {busy === "generate" ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <FileText className="size-4" />
            )}
            Generate PDF
          </Button>
        )}

        <Button
          asChild
          variant="ghost"
          size="icon"
          title="Edit"
          disabled={busy !== null}
        >
          <Link href={editHref}>
            <Pencil className="size-4" />
          </Link>
        </Button>

        <Dialog>
          <DialogTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              title="Delete"
              disabled={busy !== null}
              className="text-destructive hover:text-destructive"
            >
              <Trash2 className="size-4" />
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete this submission?</DialogTitle>
              <DialogDescription>
                {formName} draft will be permanently removed along with any
                generated PDF. This can&apos;t be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2">
              <DialogClose asChild>
                <Button variant="outline">Cancel</Button>
              </DialogClose>
              <DialogClose asChild>
                <Button
                  variant="destructive"
                  onClick={handleDelete}
                  disabled={busy !== null}
                  className="gap-2"
                >
                  {busy === "delete" && (
                    <Loader2 className="size-4 animate-spin" />
                  )}
                  Delete
                </Button>
              </DialogClose>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}
