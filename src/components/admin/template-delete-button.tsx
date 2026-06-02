"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2, Trash2 } from "lucide-react"
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
import { toast } from "@/components/ui/toaster"

export function TemplateDeleteButton({
  formCode,
  formName,
}: {
  formCode: string
  formName: string
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  async function handle() {
    setBusy(true)
    const res = await fetch(
      `/api/forms/templates/${encodeURIComponent(formCode)}`,
      { method: "DELETE" },
    )
    if (!res.ok) {
      const json = await res.json().catch(() => ({}))
      setBusy(false)
      toast({
        variant: "destructive",
        title: "Delete failed",
        description: json.error ?? "Try again.",
      })
      return
    }
    toast({
      variant: "success",
      title: "Template deleted",
      description: `${formCode} removed from the catalog.`,
    })
    router.refresh()
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          title="Delete"
          disabled={busy}
          className="text-destructive hover:text-destructive shrink-0"
        >
          {busy ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Trash2 className="size-4" />
          )}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete {formName}?</DialogTitle>
          <DialogDescription>
            Removes the row, the PDF, and every page image from Storage.
            Existing submissions stay — they keep working off their saved
            field values — but the catalog entry disappears and no new
            submission can use this template until it&apos;s re-added.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2">
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <DialogClose asChild>
            <Button
              variant="destructive"
              onClick={handle}
              disabled={busy}
              className="gap-2"
            >
              {busy && <Loader2 className="size-4 animate-spin" />}
              Delete template
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
