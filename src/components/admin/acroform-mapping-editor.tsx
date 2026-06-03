"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { CheckCircle2, Loader2, Lock, Save } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { toast } from "@/components/ui/toaster"

type SchemaField = { id: string; label: string }
type Widget = { name: string; kind: string }
type FieldLockInfo = { email: string | null; at: string }

type Props = {
  formCode: string
  fields: SchemaField[]
  /** schema field id → PDF AcroForm widget name */
  initialMapping: Record<string, string>
  fieldLocksByOther?: Record<string, FieldLockInfo>
  onActiveFieldsChange?: (ids: string[]) => void
}

/**
 * AcroForm templates can't be repositioned visually — the widget
 * positions come baked into the PDF. What CAN be edited is which
 * widget each schema field maps to. This editor lists the schema
 * fields, presents the PDF's widget names in a dropdown next to
 * each, and PATCHes the new map.
 */
export function AcroFormMappingEditor({
  formCode,
  fields,
  initialMapping,
  fieldLocksByOther = {},
  onActiveFieldsChange,
}: Props) {
  const router = useRouter()
  const [widgets, setWidgets] = useState<Widget[] | null>(null)
  const [widgetsError, setWidgetsError] = useState<string | null>(null)
  const [mapping, setMapping] = useState<Record<string, string>>(initialMapping)
  const [touched, setTouched] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)

  // Pull widget names from the PDF on mount. The AI's first-pass
  // mapping is usually close but not perfect; admin verifies here.
  useEffect(() => {
    let cancelled = false
    fetch(`/api/forms/templates/${encodeURIComponent(formCode)}/acroform-fields`)
      .then(async (r) => {
        if (cancelled) return
        if (!r.ok) {
          const j = await r.json().catch(() => ({}))
          setWidgetsError(j.error ?? `HTTP ${r.status}`)
          return
        }
        const json = await r.json()
        setWidgets(json.widgets ?? [])
      })
      .catch((e) => {
        if (!cancelled) setWidgetsError(e instanceof Error ? e.message : "Failed")
      })
    return () => {
      cancelled = true
    }
  }, [formCode])

  useEffect(() => {
    onActiveFieldsChange?.(Array.from(touched))
  }, [touched, onActiveFieldsChange])

  const assignedWidgetNames = useMemo(
    () => new Set(Object.values(mapping)),
    [mapping],
  )
  const unmappedWidgets = useMemo(
    () => (widgets ?? []).filter((w) => !assignedWidgetNames.has(w.name)),
    [widgets, assignedWidgetNames],
  )

  function setForField(fieldId: string, widgetName: string) {
    setMapping((m) => {
      const next = { ...m }
      if (widgetName === "") delete next[fieldId]
      else next[fieldId] = widgetName
      return next
    })
    setTouched((t) => {
      if (t.has(fieldId)) return t
      const n = new Set(t)
      n.add(fieldId)
      return n
    })
    setDirty(true)
  }

  async function save() {
    setSaving(true)
    const res = await fetch(
      `/api/forms/templates/${encodeURIComponent(formCode)}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ field_mapping: mapping }),
      },
    )
    setSaving(false)
    if (!res.ok) {
      const json = await res.json().catch(() => ({}))
      const description =
        json.error === "FieldLocked"
          ? `Locked field(s): ${(json.fields ?? []).join(", ")}.`
          : (json.error ?? "Try again.")
      toast({ variant: "destructive", title: "Save failed", description })
      return
    }
    toast({ variant: "success", title: "Mapping saved" })
    setDirty(false)
    setTouched(new Set())
    router.refresh()
  }

  return (
    <div className="space-y-4">
      {widgetsError && (
        <Card>
          <CardContent className="p-4 text-sm text-destructive">
            Couldn&apos;t read PDF widgets: {widgetsError}
          </CardContent>
        </Card>
      )}

      <div className="border rounded-md overflow-hidden">
        <table className="w-full text-xs">
          <thead className="bg-muted/40 text-muted-foreground">
            <tr>
              <th className="text-left px-3 py-2 font-medium w-[180px]">Field id</th>
              <th className="text-left px-3 py-2 font-medium">Label</th>
              <th className="text-left px-3 py-2 font-medium">PDF widget</th>
            </tr>
          </thead>
          <tbody>
            {fields.map((f) => {
              const lock = fieldLocksByOther[f.id]
              const locked = !!lock
              return (
                <tr key={f.id} className={locked ? "bg-amber-50/40 dark:bg-amber-950/20 border-t" : "border-t"}>
                  <td className="px-3 py-2 align-top font-mono text-[11px]">
                    <span className="inline-flex items-center gap-1.5">
                      {locked && (
                        <Lock
                          className="size-3 text-amber-600"
                          aria-label={`Locked by ${lock.email ?? "another admin"}`}
                        />
                      )}
                      {f.id}
                    </span>
                  </td>
                  <td className="px-3 py-2 align-top">{f.label}</td>
                  <td className="px-3 py-2 align-top">
                    {widgets ? (
                      <select
                        value={mapping[f.id] ?? ""}
                        onChange={(e) => setForField(f.id, e.target.value)}
                        disabled={locked}
                        className="flex h-8 w-full rounded-md border border-input bg-background px-2 text-xs disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <option value="">— Unmapped —</option>
                        {widgets.map((w) => (
                          <option key={w.name} value={w.name}>
                            {w.name} ({w.kind})
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="text-muted-foreground">
                        {widgetsError ? "—" : "Loading…"}
                      </span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {widgets && unmappedWidgets.length > 0 && (
        <Card>
          <CardContent className="p-3 text-xs space-y-1.5">
            <p className="font-medium">
              {unmappedWidgets.length} PDF widget{unmappedWidgets.length === 1 ? "" : "s"} not mapped to any schema field:
            </p>
            <p className="font-mono text-muted-foreground break-all">
              {unmappedWidgets.map((w) => w.name).join(", ")}
            </p>
            <p className="text-muted-foreground">
              These widgets are present in the PDF but no schema field
              points to them. Add a schema field below if you need one.
            </p>
          </CardContent>
        </Card>
      )}

      <div className="flex justify-end">
        <Button
          onClick={save}
          disabled={!dirty || saving || !widgets}
          size="sm"
          className="gap-2"
        >
          {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
          Save mapping
        </Button>
      </div>
    </div>
  )
}

export function NoOpMappingHint() {
  return (
    <p className="text-xs text-muted-foreground inline-flex items-center gap-1.5">
      <CheckCircle2 className="size-3" /> All widgets mapped.
    </p>
  )
}
