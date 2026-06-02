"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Loader2, RefreshCw } from "lucide-react"

/**
 * Triggers a manual reminders-recompute. The daily cron will normally
 * keep things in sync; this is the "I just uploaded a new document with
 * an expiry, generate the reminders right now" escape hatch.
 */
export function RecomputeRemindersButton() {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handle() {
    setBusy(true)
    setError(null)
    const res = await fetch("/api/reminders/recompute", { method: "POST" })
    if (!res.ok) {
      const json = await res.json().catch(() => ({}))
      setError(json.error || "Recompute failed")
      setBusy(false)
      setTimeout(() => setError(null), 5000)
      return
    }
    router.refresh()
    setBusy(false)
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button onClick={handle} disabled={busy} variant="outline" size="sm" className="gap-2">
        {busy ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
        Recompute now
      </Button>
      {error && <span className="text-xs text-destructive">{error}</span>}
    </div>
  )
}
