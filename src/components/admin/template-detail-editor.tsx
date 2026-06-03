"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import {
  AlertCircle,
  ExternalLink,
  Loader2,
  Save,
  Users,
} from "lucide-react"
import { useTemplatePresence } from "@/hooks/use-template-lock"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  FormEditorOverlay,
  type EditorTemplate,
  type NewFieldRequest,
} from "@/components/forms/form-editor-overlay"
import { FieldSchemaEditor } from "@/components/admin/field-schema-editor"
import { AcroFormMappingEditor } from "@/components/admin/acroform-mapping-editor"
import { ReplacePdfButton } from "@/components/admin/replace-pdf-button"
import { ReanalyzeAIButton } from "@/components/admin/reanalyze-ai-button"
import { TemplateExportButton } from "@/components/admin/template-export-button"
import { toast } from "@/components/ui/toaster"
import type { FieldOverrides, CoordSpec } from "@/lib/forms/template-types"

function slugifyId(label: string, existing: Set<string>): string {
  const base =
    label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 40) || "field"
  if (!existing.has(base)) return base
  for (let i = 2; i < 1000; i++) {
    const candidate = `${base}_${i}`
    if (!existing.has(candidate)) return candidate
  }
  return `${base}_${Date.now()}`
}

type FieldSchema = {
  form_code: string
  form_name: string
  agency: string
  fields: Array<{
    id: string
    label: string
    semantic_type: string
    data_source: string | null
    required: boolean
    period_specific: boolean
  }>
}

export type AdminTemplateMeta = {
  form_code: string
  form_name: string
  agency: string
  frequency: string | null
  description: string | null
  is_active: boolean
  source_url: string | null
  last_checked_at: string | null
  last_changed_at: string | null
  created_at: string | null
}

type Props = {
  template: EditorTemplate
  meta: AdminTemplateMeta
  fieldSchema: FieldSchema | null
}

export function TemplateDetailEditor({ template, meta, fieldSchema }: Props) {
  const router = useRouter()

  // Layout overrides — relative deltas in PDF points. Persisted to the
  // template's field_mapping by "Save layout".
  const [overrides, setOverrides] = useState<FieldOverrides>({})
  // Fields the layout overlay reports as actively being dragged. Used
  // by the presence heartbeat to keep their field locks fresh.
  const [activeLayoutFields, setActiveLayoutFields] = useState<string[]>([])
  // Fields the schema editor reports as actively being inline-edited.
  const [activeSchemaFields, setActiveSchemaFields] = useState<string[]>([])

  const heldFields = useMemo(
    () => Array.from(new Set([...activeLayoutFields, ...activeSchemaFields])),
    [activeLayoutFields, activeSchemaFields],
  )

  const presence = useTemplatePresence(meta.form_code, heldFields)

  // Metadata edit state
  const [formName, setFormName] = useState(meta.form_name)
  const [agency, setAgency] = useState(meta.agency)
  const [frequency, setFrequency] = useState(meta.frequency ?? "")
  const [description, setDescription] = useState(meta.description ?? "")
  const [isActive, setIsActive] = useState(meta.is_active)
  const [sourceUrl, setSourceUrl] = useState(meta.source_url ?? "")
  const [savingMeta, setSavingMeta] = useState(false)

  function setOverride(id: string, next: { dx: number; dy: number } | null) {
    setOverrides((s) => {
      if (!next) {
        const { [id]: _, ...rest } = s
        return rest
      }
      return { ...s, [id]: next }
    })
    // Dragging this field locks it for the rest of the session.
    if (next && !activeLayoutFields.includes(id)) {
      setActiveLayoutFields((s) => [...s, id])
    }
  }

  async function saveMeta() {
    setSavingMeta(true)
    const res = await fetch(
      `/api/forms/templates/${encodeURIComponent(meta.form_code)}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          form_name: formName,
          agency,
          frequency: frequency || null,
          description: description || null,
          is_active: isActive,
          source_url: sourceUrl || null,
        }),
      },
    )
    setSavingMeta(false)
    if (!res.ok) {
      const json = await res.json().catch(() => ({}))
      toast({
        variant: "destructive",
        title: "Save failed",
        description: json.error ?? "Try again.",
      })
      return
    }
    toast({ variant: "success", title: "Metadata saved" })
    router.refresh()
  }

  async function addFieldAtPosition(
    spec: NewFieldRequest,
  ): Promise<{ ok: boolean; message: string }> {
    if (!fieldSchema) {
      return { ok: false, message: "No schema to add to" }
    }
    if (template.mapping.strategy !== "coordinates") {
      return { ok: false, message: "Not a coordinate template" }
    }

    const existingIds = new Set(fieldSchema.fields.map((f) => f.id))
    const newId = slugifyId(spec.label, existingIds)

    const width = 160
    const height = 14
    const size = 10
    const baselineY = template.dimensions.height - spec.y_top - height + 1

    const isPeriodSpec =
      spec.semantic_type === "period_month" ||
      spec.semantic_type === "period_year"

    const newSchemaFields = [
      ...fieldSchema.fields,
      {
        id: newId,
        label: spec.label,
        semantic_type: spec.semantic_type,
        data_source: spec.data_source,
        required: spec.required,
        period_specific: isPeriodSpec,
      },
    ]

    const newMapping: Record<string, CoordSpec> = {
      ...template.mapping.fields,
      [newId]: {
        page: spec.page,
        x: spec.x,
        y: baselineY,
        width,
        height,
        size,
      },
    }

    const res = await fetch(
      `/api/forms/templates/${encodeURIComponent(meta.form_code)}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          field_schema: {
            form_code: meta.form_code,
            form_name: meta.form_name,
            agency: meta.agency,
            fields: newSchemaFields,
          },
          field_mapping: newMapping,
        }),
      },
    )
    if (!res.ok) {
      const json = await res.json().catch(() => ({}))
      const msg =
        json.error === "FieldLocked"
          ? `Locked field(s): ${(json.fields ?? []).join(", ")}`
          : (json.error ?? "Save failed")
      return { ok: false, message: msg }
    }
    router.refresh()
    return { ok: true, message: `Added "${spec.label}" on page ${spec.page}` }
  }

  async function saveLayout(): Promise<{ ok: boolean; message: string }> {
    if (template.mapping.strategy !== "coordinates") {
      return { ok: false, message: "Not a coordinate template" }
    }
    if (Object.keys(overrides).length === 0) {
      return { ok: false, message: "Drag a field first to record changes" }
    }
    const merged: Record<string, CoordSpec> = {}
    for (const [id, spec] of Object.entries(template.mapping.fields)) {
      const o = overrides[id]
      if (!o) {
        merged[id] = spec
        continue
      }
      const baseW = spec.width ?? spec.maxWidth ?? 100
      const baseH = spec.height ?? (spec.size ?? 10) + 2
      const dw = o.dw ?? 0
      const dh = o.dh ?? 0
      merged[id] = {
        ...spec,
        x: spec.x + o.dx,
        y: spec.y + o.dy - dh,
        width: Math.max(20, baseW + dw),
        height: Math.max(8, baseH + dh),
      }
    }
    const res = await fetch(
      `/api/forms/templates/${encodeURIComponent(meta.form_code)}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ field_mapping: merged }),
      },
    )
    if (!res.ok) {
      const json = await res.json().catch(() => ({}))
      const msg =
        json.error === "FieldLocked"
          ? `Locked field(s): ${(json.fields ?? []).join(", ")}. Wait for the other admin to finish.`
          : (json.error ?? "Save failed")
      return { ok: false, message: msg }
    }
    setOverrides({})
    setActiveLayoutFields([])
    router.refresh()
    return { ok: true, message: "Layout saved" }
  }

  return (
    <div className="space-y-6">
      <PresenceBar presence={presence} />

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Metadata</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="form_code" className="text-xs">Form code</Label>
              <Input
                id="form_code"
                value={meta.form_code}
                readOnly
                className="font-mono bg-muted/40"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="agency" className="text-xs">Issuer</Label>
              <Input id="agency" value={agency} onChange={(e) => setAgency(e.target.value)} />
            </div>
            <div className="md:col-span-2 space-y-1.5">
              <Label htmlFor="form_name" className="text-xs">Form name</Label>
              <Input id="form_name" value={formName} onChange={(e) => setFormName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="frequency" className="text-xs">Filing frequency</Label>
              <select
                id="frequency"
                value={frequency}
                onChange={(e) => setFrequency(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="">— None —</option>
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
                <option value="annual">Annual</option>
                <option value="per_payment">Per payment</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="is_active" className="text-xs">Status</Label>
              <div className="flex items-center h-10 gap-2 text-sm">
                <input
                  id="is_active"
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="size-4"
                />
                <span className="text-muted-foreground">
                  {isActive ? "Active — appears in /forms" : "Disabled — hidden from users"}
                </span>
              </div>
            </div>
            <div className="md:col-span-2 space-y-1.5">
              <Label htmlFor="source_url" className="text-xs">
                Source URL (watched by the weekly cron)
              </Label>
              <div className="flex gap-2">
                <Input
                  id="source_url"
                  value={sourceUrl}
                  onChange={(e) => setSourceUrl(e.target.value)}
                  placeholder="https://www.bir.gov.ph/..."
                  type="url"
                />
                {sourceUrl && (
                  <Button asChild variant="outline" size="icon" title="Open in new tab">
                    <a href={sourceUrl} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="size-4" />
                    </a>
                  </Button>
                )}
              </div>
            </div>
            <div className="md:col-span-2 space-y-1.5">
              <Label htmlFor="description" className="text-xs">Description (admin-only)</Label>
              <textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                placeholder="Notes for other admins"
              />
            </div>
          </div>
          {meta.last_checked_at && (
            <p className="text-xs text-muted-foreground">
              Last source check <time>{new Date(meta.last_checked_at).toLocaleString()}</time>
              {meta.last_changed_at && (
                <> · Last change <time>{new Date(meta.last_changed_at).toLocaleString()}</time></>
              )}
            </p>
          )}
          <div className="flex justify-end">
            <Button onClick={saveMeta} disabled={savingMeta} size="sm" className="gap-2">
              {savingMeta ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
              Save metadata
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* WYSIWYG layout (coordinate templates) */}
      {fieldSchema && template.mapping.strategy === "coordinates" && (
        <Card>
          <CardHeader className="pb-3 flex flex-row items-start justify-between gap-3">
            <div className="space-y-1">
              <CardTitle className="text-base">Layout</CardTitle>
              <p className="text-xs text-muted-foreground">
                Switch to <strong>Edit layout</strong> below to drag fields.
                When you&apos;re happy, <strong>Save as template default</strong>{" "}
                writes the new positions to the catalog for everyone.
              </p>
            </div>
            <div className="flex gap-2 shrink-0 flex-wrap justify-end">
              <TemplateExportButton formCode={meta.form_code} />
              <ReanalyzeAIButton
                formCode={meta.form_code}
                formName={meta.form_name}
                agency={meta.agency}
                dimensions={template.dimensions}
                existingFields={fieldSchema.fields}
                existingMapping={template.mapping.fields}
              />
              <ReplacePdfButton
                formCode={meta.form_code}
                currentPageCount={template.dimensions.pageCount}
              />
            </div>
          </CardHeader>
          <CardContent>
            <FormEditorOverlay
              formCode={meta.form_code}
              template={template}
              fields={fieldSchema.fields.map((f) => ({
                id: f.id,
                label: f.label,
                required: f.required,
              }))}
              values={Object.fromEntries(
                fieldSchema.fields.map((f) => [f.id, `[${f.label}]`]),
              )}
              onChange={() => {}}
              overrides={overrides}
              onOverrideChange={setOverride}
              onReplaceOverrides={setOverrides}
              isAdmin
              onSaveAsTemplate={saveLayout}
              onAddField={addFieldAtPosition}
              fieldLocksByOther={Object.fromEntries(
                Object.entries(presence.editingFields)
                  .filter(([, v]) => v.user_id !== presence.myUserId)
                  .map(([fid, v]) => [fid, v]),
              )}
            />
          </CardContent>
        </Card>
      )}

      {/* AcroForm mapping (acroform templates) */}
      {fieldSchema && template.mapping.strategy === "acroform" && (
        <Card>
          <CardHeader className="pb-3 flex flex-row items-start justify-between gap-3">
            <div className="space-y-1">
              <CardTitle className="text-base">AcroForm mapping</CardTitle>
              <p className="text-xs text-muted-foreground">
                This PDF has built-in form widgets. Map each schema field
                to the PDF widget it should fill.
              </p>
            </div>
            <div className="flex gap-2 shrink-0">
              <TemplateExportButton formCode={meta.form_code} />
              <ReplacePdfButton
                formCode={meta.form_code}
                currentPageCount={template.dimensions.pageCount}
              />
            </div>
          </CardHeader>
          <CardContent>
            <AcroFormMappingEditor
              formCode={meta.form_code}
              fields={fieldSchema.fields.map((f) => ({ id: f.id, label: f.label }))}
              initialMapping={template.mapping.fields}
              fieldLocksByOther={Object.fromEntries(
                Object.entries(presence.editingFields)
                  .filter(([, v]) => v.user_id !== presence.myUserId)
                  .map(([fid, v]) => [fid, v]),
              )}
              onActiveFieldsChange={setActiveLayoutFields}
            />
          </CardContent>
        </Card>
      )}

      {!fieldSchema && (
        <Card>
          <CardContent className="p-6 flex items-start gap-3">
            <AlertCircle className="size-5 text-amber-600 mt-0.5" />
            <div>
              <p className="text-sm font-medium">No field schema yet</p>
              <p className="text-xs text-muted-foreground mt-1">
                This template was added via the code-side registry. Re-upload
                via <strong>Add a template</strong> to get a DB-stored schema
                you can edit here.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Field schema (editable) */}
      {fieldSchema && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              Fields ({fieldSchema.fields.length})
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Add, rename, retype, or remove fields. New fields get a
              default position you can drag-correct in the Layout panel
              above; removed fields disappear from the WYSIWYG editor too.
            </p>
          </CardHeader>
          <CardContent>
            <FieldSchemaEditor
              formCode={meta.form_code}
              formName={meta.form_name}
              agency={meta.agency}
              initialFields={fieldSchema.fields}
              fieldLocksByOther={Object.fromEntries(
                Object.entries(presence.editingFields)
                  .filter(([, v]) => v.user_id !== presence.myUserId)
                  .map(([fid, v]) => [fid, v]),
              )}
              onActiveFieldsChange={setActiveSchemaFields}
            />
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function PresenceBar({
  presence,
}: {
  presence: ReturnType<typeof useTemplatePresence>
}) {
  if (presence.others.length === 0) return null
  const names = presence.others.map((o) => o.email ?? "anon").join(", ")
  return (
    <div className="rounded-md border border-amber-500/40 bg-amber-50 dark:bg-amber-950/30 px-3 py-2 text-xs flex items-center gap-2 text-amber-900 dark:text-amber-100">
      <Users className="size-3.5" />
      <span>
        Also editing this template: <strong>{names}</strong>. Per-field
        locks prevent overlapping edits — your save will be refused if
        you touch a field they&apos;re working on.
      </span>
    </div>
  )
}
