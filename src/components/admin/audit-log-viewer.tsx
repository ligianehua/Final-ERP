"use client"

import { useEffect, useMemo, useState } from "react"
import { ChevronDown, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

type Entry = {
  id: number
  actor_id: string | null
  actor_email: string | null
  action: string
  target_kind: string
  target_id: string
  before: unknown
  after: unknown
  at: string
}

const ACTION_LABEL: Record<string, string> = {
  "template.update_metadata": "Metadata update",
  "template.update_schema": "Schema edit",
  "template.update_field_mapping": "Layout / mapping",
  "template.update_field": "Field edit",
  "template.replace_pdf": "PDF replaced",
  "template.delete": "Template deleted",
  "template.lock_takeover": "Lock takeover",
}

export function AuditLogViewer({ initialEntries }: { initialEntries: Entry[] }) {
  const [entries, setEntries] = useState<Entry[]>(initialEntries)
  const [actorFilter, setActorFilter] = useState("")
  const [actionFilter, setActionFilter] = useState("")
  const [targetFilter, setTargetFilter] = useState("")
  const [refreshing, setRefreshing] = useState(false)
  const [expanded, setExpanded] = useState<Set<number>>(new Set())

  const filtered = useMemo(() => {
    return entries.filter((e) => {
      if (actorFilter && !(e.actor_email ?? "").toLowerCase().includes(actorFilter.toLowerCase())) {
        return false
      }
      if (actionFilter && !e.action.includes(actionFilter)) return false
      if (targetFilter && !e.target_id.toLowerCase().includes(targetFilter.toLowerCase())) {
        return false
      }
      return true
    })
  }, [entries, actorFilter, actionFilter, targetFilter])

  async function refresh() {
    setRefreshing(true)
    try {
      const res = await fetch("/api/admin/audit?limit=200", { cache: "no-store" })
      if (res.ok) {
        const json = await res.json()
        setEntries(json.entries ?? [])
      }
    } finally {
      setRefreshing(false)
    }
  }

  // Light polling — admin staring at this page wants to see new
  // events without manually refreshing.
  useEffect(() => {
    const id = window.setInterval(refresh, 30_000)
    return () => window.clearInterval(id)
  }, [])

  function toggle(id: number) {
    setExpanded((s) => {
      const next = new Set(s)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-2 items-end">
        <label className="space-y-1">
          <span className="text-xs text-muted-foreground">Actor email</span>
          <Input
            value={actorFilter}
            onChange={(e) => setActorFilter(e.target.value)}
            placeholder="alice@…"
            className="h-9"
          />
        </label>
        <label className="space-y-1">
          <span className="text-xs text-muted-foreground">Action</span>
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="flex h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
          >
            <option value="">— Any —</option>
            {Object.entries(ACTION_LABEL).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </label>
        <label className="space-y-1">
          <span className="text-xs text-muted-foreground">Target id</span>
          <Input
            value={targetFilter}
            onChange={(e) => setTargetFilter(e.target.value)}
            placeholder="BIR_2550M…"
            className="h-9 font-mono"
          />
        </label>
        <Button variant="outline" size="sm" onClick={refresh} disabled={refreshing}>
          {refreshing ? "Refreshing…" : "Refresh"}
        </Button>
      </div>

      <div className="border rounded-md overflow-hidden">
        <table className="w-full text-xs">
          <thead className="bg-muted/40 text-muted-foreground">
            <tr>
              <th className="w-6" />
              <th className="text-left px-3 py-2 font-medium w-[160px]">When</th>
              <th className="text-left px-3 py-2 font-medium">Actor</th>
              <th className="text-left px-3 py-2 font-medium w-[180px]">Action</th>
              <th className="text-left px-3 py-2 font-medium w-[200px]">Target</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((e) => {
              const open = expanded.has(e.id)
              const hasDiff = e.before !== null || e.after !== null
              return (
                <FragmentRow
                  key={e.id}
                  e={e}
                  open={open}
                  hasDiff={hasDiff}
                  onToggle={() => toggle(e.id)}
                />
              )
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">
                  No matching events.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function FragmentRow({
  e,
  open,
  hasDiff,
  onToggle,
}: {
  e: Entry
  open: boolean
  hasDiff: boolean
  onToggle: () => void
}) {
  return (
    <>
      <tr className={cn("border-t", open && "bg-muted/30")}>
        <td className="px-2 py-1.5 align-top">
          <button
            type="button"
            onClick={onToggle}
            disabled={!hasDiff}
            className="text-muted-foreground hover:text-foreground disabled:opacity-30"
          >
            {open ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
          </button>
        </td>
        <td className="px-3 py-1.5 align-top tabular-nums">
          {new Date(e.at).toLocaleString()}
        </td>
        <td className="px-3 py-1.5 align-top">{e.actor_email ?? "—"}</td>
        <td className="px-3 py-1.5 align-top">
          {ACTION_LABEL[e.action] ?? e.action}
        </td>
        <td className="px-3 py-1.5 align-top font-mono text-[11px]">
          {e.target_id}
        </td>
      </tr>
      {open && hasDiff && (
        <tr className="border-t">
          <td />
          <td colSpan={4} className="px-3 py-2 bg-muted/20">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <DiffPane label="Before" value={e.before} />
              <DiffPane label="After" value={e.after} />
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

function DiffPane({ label, value }: { label: string; value: unknown }) {
  if (value === null || value === undefined) {
    return (
      <div>
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">{label}</p>
        <p className="text-muted-foreground italic">—</p>
      </div>
    )
  }
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">{label}</p>
      <pre className="text-[11px] font-mono bg-background border rounded p-2 max-h-64 overflow-auto whitespace-pre-wrap break-all">
        {JSON.stringify(value, null, 2)}
      </pre>
    </div>
  )
}
