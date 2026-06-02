"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Check, Clock, Loader2, MoreHorizontal } from "lucide-react"

type Props = {
  reminderId: string
}

const SNOOZE_OPTIONS: { label: string; days: number }[] = [
  { label: "Tomorrow", days: 1 },
  { label: "7 days", days: 7 },
  { label: "30 days", days: 30 },
]

function todayPlusDays(days: number): string {
  const d = new Date()
  d.setUTCHours(0, 0, 0, 0)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

export function ReminderActions({ reminderId }: Props) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  async function patch(body: Record<string, string | null>) {
    setBusy(true)
    const res = await fetch(`/api/reminders/${reminderId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
    if (res.ok) router.refresh()
    setBusy(false)
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          disabled={busy}
          className="size-8"
          title="Actions"
        >
          {busy ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <MoreHorizontal className="size-4" />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[160px]">
        <DropdownMenuLabel className="text-xs text-muted-foreground inline-flex items-center gap-1.5">
          <Clock className="size-3" /> Snooze until
        </DropdownMenuLabel>
        {SNOOZE_OPTIONS.map((opt) => (
          <DropdownMenuItem
            key={opt.days}
            onClick={() => patch({ snoozed_until: todayPlusDays(opt.days) })}
          >
            {opt.label}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => patch({ dismissed_at: new Date().toISOString() })}
        >
          <Check className="size-3.5 mr-2" />
          Mark done
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
