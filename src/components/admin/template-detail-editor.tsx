"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import {
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  Loader2,
  Lock,
  Save,
  Unlock,
} from "lucide-react"
import { useTemplateLock } from "@/hooks/use-template-lock"
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
  const lock = useTemplateLock(meta.form_code)
  const isViewer = lock.mode === "viewer"

  // Metadata edit state
  const [formName, setFormName] = useState(meta.form_name)
  const [agency, setAgency] = useState(meta.agency)
  const [frequency, setFrequency] = useState(meta.frequency ?? "")
  const [description, setDescription] = useState(meta.description ?? "")
  const [isActive, setIsActive] = useState(meta.is_active)
  const [sourceUrl, setSourceUrl] = useState(meta.source_url ?? "")
  const [savingMeta, setSavingMeta] = useState(false)

  // Layout overrides — relative deltas in PDF points. Persisted to the
  // template's field_mapping by "Save layout".
  const [overrides, setOverrides] = useState<FieldOverrides>({})

  function setOverride(id: string, next: { dx: number; dy: number } | null) {
    setOverrides((s) => {
      if (!next) {
        const { [id]: _, ...rest } = s
        return rest
      }
      return { ...s, [id]: next }
    })
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

    // Pick an id that doesn't collide with anything already in the
    // schema (the coord-map keys mirror the schema ids).
    const existingIds = new Set(fieldSchema.fields.map((f) => f.id))
    const newId = slugifyId(spec.label, existingIds)

    // Default box geometry — admin can drag-tune in Layout mode.
    const width = 160
    const height = 14
    const size = 10
    // Top-down click → pdf-lib baseline-y (bottom-up).
    const baselineY =
      template.dimensions.height - spec.y_top - height + 1

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
      return { ok: false, message: json.error ?? "Save failed" }
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
        // Baseline-y compensated by -dh so the rendered text top stays
        // where the admin dragged it during resize.
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
      return { ok: false, message: json.error ?? "Save failed" }
    }
    setOverrides({})
    router.refresh()
    return { ok: true, message: "Layout saved" }
  }

  return (
    <div className="space-y-6">
      <LockBanner state={lock} />

      {/* Metadata */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Metadata</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="form_code" className="text-xs">
                Form code
              </Label>
              <Input
                id="form_code"
                value={meta.form_code}
                readOnly
                className="font-mono bg-muted/40"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="agency" className="text-xs">
                Issuer
              </Label>
              <Input
                id="agency"
                value={agency}
                onChange={(e) => setAgency(e.target.value)}
              />
            </div>
            <div className="md:col-span-2 space-y-1.5">
              <Label htmlFor="form_name" className="text-xs">
                Form name
              </Label>
              <Input
                id="form_name"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="frequency" className="text-xs">
                Filing frequency
              </Label>
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
              <Label htmlFor="is_active" className="text-xs">
                Status
              </Label>
              <div className="flex items-center h-10 gap-2 text-sm">
                <input
                  id="is_active"
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="size-4"
                />
                <span className="text-muted-foreground">
                  {isActive
                    ? "Active — appears in /forms"
                    : "Disabled — hidden from users"}
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
              <Label htmlFor="description" className="text-xs">
                Description (admin-only)
              </Label>
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
              Last source check{" "}
              <time>{new Date(meta.last_checked_at).toLocaleString()}</time>
              {meta.last_changed_at && (
                <>
                  {" · "}Last change{" "}
                  <time>
                    {new Date(meta.last_changed_at).toLocaleString()}
                  </time>
                </>
              )}
            </p>
          )}
          <div className="flex justify-end">
            <Button onClick={saveMeta} disabled={savingMeta} size="sm" className="gap-2">
              {savingMeta ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Save className="size-4" />
              )}
              Save metadata
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* WYSIWYG layout */}
      {fieldSchema ? (
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
              {template.mapping.strategy === "coordinates" && !isViewer && (
                <ReanalyzeAIButton
                  formCode={meta.form_code}
                  formName={meta.form_name}
                  agency={meta.agency}
                  dimensions={template.dimensions}
                  existingFields={fieldSchema.fields}
                  existingMapping={template.mapping.fields}
                />
              )}
              {!isViewer && (
                <ReplacePdfButton
                  formCode={meta.form_code}
                  currentPageCount={template.dimensions.pageCount}
                />
              )}
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
              // Use the field labels themselves as placeholder values so
              // the admin can see what's where on the form without a
              // company picked.
              values={Object.fromEntries(
                fieldSchema.fields.map((f) => [f.id, `[${f.label}]`]),
              )}
              onChange={() => {
                /* read-only in admin layout view */
              }}
              overrides={overrides}
              onOverrideChange={setOverride}
              onReplaceOverrides={setOverrides}
              isAdmin
              onSaveAsTemplate={isViewer ? undefined : saveLayout}
              onAddField={isViewer ? undefined : addFieldAtPosition}
            />
          </CardContent>
        </Card>
      ) : (
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
              readOnly={isViewer}
            />
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function LockBanner({
  state,
}: {
  state: ReturnType<typeof useTemplateLock>
}) {
  if (state.mode === "loading") return null
  if (state.mode === "error") {
    return (
      <div className="rounded-md border border-destructive/40 bg-destructive/5 px-4 py-2 text-sm text-destructive inline-flex items-center gap-2">
        <AlertCircle className="size-4" />
        Lock check failed: {state.error}. Edits may collide with another
        admin — refresh to retry.
      </div>
    )
  }
  if (state.mode === "viewer") {
    return (
      <div className="rounded-md border border-amber-500/40 bg-amber-50 dark:bg-amber-950/30 px-4 py-3 text-sm flex items-center justify-between gap-3">
        <div className="flex items-start gap-2">
          <Lock className="size-4 text-amber-700 dark:text-amber-300 mt-0.5 shrink-0" />
          <div className="text-amber-900 dark:text-amber-100">
            <span className="font-medium">
              {state.holder.email ?? "Another admin"}
            </span>{" "}
            is editing this template (locked{" "}
            <time className="tabular-nums">
              {new Date(state.holder.since).toLocaleTimeString()}
            </time>
            ). Your saves will be refused until they release. The page
            will unlock automatically when they leave.
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={state.takeover}
          className="shrink-0 gap-2 border-amber-600/40"
        >
          <Unlock className="size-3.5" />
          Take over
        </Button>
      </div>
    )
  }
  if (state.tookOver) {
    return (
      <div className="rounded-md border border-green-600/30 bg-green-50 dark:bg-green-950/30 px-4 py-2 text-xs text-green-900 dark:text-green-100 inline-flex items-center gap-2">
        <CheckCircle2 className="size-3.5" />
        Lock taken over. You are now the editor.
      </div>
    )
  }
  return null
}
