"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Loader2, RefreshCw } from "lucide-react"
import { toast } from "@/components/ui/toaster"

/**
 * Triggers a manual reminders-recompute. The daily cron will normally
 * keep things in sync; this is the "I just uploaded a new document with
 * an expiry, generate the reminders right now" escape hatch.
 */
export function RecomputeRemindersButton() {
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  async function handle() {
    setBusy(true)
    const res = await fetch("/api/reminders/recompute", { method: "POST" })
    const json = await res.json().catch(() => ({}))
    setBusy(false)
    if (!res.ok) {
      toast({
        variant: "destructive",
        title: "Recompute failed",
        description: json.error ?? "Try again in a moment.",
      })
      return
    }
    toast({
      variant: "success",
      title: "Reminders refreshed",
      description:
        typeof json.created === "number"
          ? `${json.created} new row${json.created === 1 ? "" : "s"} created.`
          : "Up to date.",
    })
    router.refresh()
  }

  return (
    <Button onClick={handle} disabled={busy} variant="outline" size="sm" className="gap-2">
      {busy ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
      Recompute now
    </Button>
  )
}
