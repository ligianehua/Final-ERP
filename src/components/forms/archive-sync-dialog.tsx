"use client"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { ArrowRight, Building2, Loader2, User } from "lucide-react"
import { cn } from "@/lib/utils"

/** A single archive value the user changed during this filing. */
export type SyncCandidate = {
  fieldId: string
  label: string
  source: string
  before: string
  after: string
  /** Computed routing for the PATCH call. */
  targetTable: "companies" | "company_people"
  targetId: string
  targetField: string
}

type Props = {
  open: boolean
  candidates: SyncCandidate[]
  companyName: string
  signatoryName: string | null
  /** Called with the subset to apply; resolves once PATCHes complete. */
  onApply: (selected: SyncCandidate[]) => Promise<void>
  onSkip: () => void
}

export function ArchiveSyncDialog({
  open,
  candidates,
  companyName,
  signatoryName,
  onApply,
  onSkip,
}: Props) {
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(candidates.map((c) => c.fieldId)),
  )
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function toggle(fieldId: string) {
    setSelected((s) => {
      const next = new Set(s)
      if (next.has(fieldId)) next.delete(fieldId)
      else next.add(fieldId)
      return next
    })
  }

  async function handleApply() {
    setBusy(true)
    setError(null)
    try {
      const picks = candidates.filter((c) => selected.has(c.fieldId))
      await onApply(picks)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed")
      setBusy(false)
      return
    }
    setBusy(false)
  }

  const companyChanges = candidates.filter((c) => c.targetTable === "companies")
  const personChanges = candidates.filter(
    (c) => c.targetTable === "company_people",
  )

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o && !busy) onSkip()
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Update archive with edited values?</DialogTitle>
          <DialogDescription>
            You changed these during this filing. Apply the same edits to
            the archive so future filings start with the right values.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 max-h-[55vh] overflow-y-auto">
          {companyChanges.length > 0 && (
            <SyncGroup
              icon={<Building2 className="size-4" />}
              title={companyName}
              subtitle="Company archive"
              candidates={companyChanges}
              selected={selected}
              onToggle={toggle}
              disabled={busy}
            />
          )}
          {personChanges.length > 0 && (
            <SyncGroup
              icon={<User className="size-4" />}
              title={signatoryName ?? "Signatory"}
              subtitle="People roster"
              candidates={personChanges}
              selected={selected}
              onToggle={toggle}
              disabled={busy}
            />
          )}
        </div>

        {error && (
          <p className="text-sm text-destructive border border-destructive/30 rounded-md p-2.5">
            {error}
          </p>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onSkip} disabled={busy}>
            Skip
          </Button>
          <Button
            onClick={handleApply}
            disabled={busy || selected.size === 0}
            className="gap-2"
          >
            {busy && <Loader2 className="size-4 animate-spin" />}
            Update archive ({selected.size})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function SyncGroup({
  icon,
  title,
  subtitle,
  candidates,
  selected,
  onToggle,
  disabled,
}: {
  icon: React.ReactNode
  title: string
  subtitle: string
  candidates: SyncCandidate[]
  selected: Set<string>
  onToggle: (id: string) => void
  disabled: boolean
}) {
  return (
    <div className="rounded-md border">
      <div className="flex items-center gap-2 px-3 py-2 border-b bg-muted/40">
        <div className="size-7 rounded bg-background flex items-center justify-center text-muted-foreground">
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium truncate">{title}</p>
          <p className="text-[10px] text-muted-foreground">{subtitle}</p>
        </div>
      </div>
      <ul className="divide-y">
        {candidates.map((c) => {
          const checked = selected.has(c.fieldId)
          return (
            <li key={c.fieldId}>
              <label
                className={cn(
                  "flex items-start gap-3 px-3 py-2.5 cursor-pointer hover:bg-muted/30",
                  disabled && "cursor-not-allowed opacity-60",
                )}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => onToggle(c.fieldId)}
                  disabled={disabled}
                  className="mt-0.5 size-4"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium">{c.label}</p>
                  <div className="flex items-center gap-2 text-xs mt-0.5 flex-wrap">
                    <span className="text-muted-foreground line-through max-w-[180px] truncate">
                      {c.before || "(empty)"}
                    </span>
                    <ArrowRight className="size-3 text-muted-foreground shrink-0" />
                    <span className="font-medium max-w-[180px] truncate">
                      {c.after || "(empty)"}
                    </span>
                  </div>
                </div>
              </label>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
