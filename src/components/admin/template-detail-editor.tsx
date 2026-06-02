"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import {
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  Loader2,
  Save,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  FormEditorOverlay,
  type EditorTemplate,
} from "@/components/forms/form-editor-overlay"
import { toast } from "@/components/ui/toaster"
import type { FieldOverrides, CoordSpec } from "@/lib/forms/template-types"

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
      merged[id] = o ? { ...spec, x: spec.x + o.dx, y: spec.y + o.dy } : spec
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
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Layout</CardTitle>
            <p className="text-xs text-muted-foreground">
              Switch to <strong>Edit layout</strong> below to drag fields.
              When you&apos;re happy, <strong>Save as template default</strong>{" "}
              writes the new positions to the catalog for everyone.
            </p>
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
              isAdmin
              onSaveAsTemplate={saveLayout}
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

      {/* Field schema (read-only for now) */}
      {fieldSchema && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              Fields ({fieldSchema.fields.length})
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              The data model for this template. Editing field metadata is
              coming — for now, re-upload to change it.
            </p>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-xs">
              <thead className="bg-muted/40 text-muted-foreground">
                <tr>
                  <th className="text-left px-3 py-2 font-medium">ID</th>
                  <th className="text-left px-3 py-2 font-medium">Label</th>
                  <th className="text-left px-3 py-2 font-medium">Semantic</th>
                  <th className="text-left px-3 py-2 font-medium">Source</th>
                  <th className="text-center px-3 py-2 font-medium">Req</th>
                  <th className="text-center px-3 py-2 font-medium">Period</th>
                </tr>
              </thead>
              <tbody>
                {fieldSchema.fields.map((f) => (
                  <tr key={f.id} className="border-t">
                    <td className="px-3 py-2 font-mono text-[11px]">{f.id}</td>
                    <td className="px-3 py-2">{f.label}</td>
                    <td className="px-3 py-2 font-mono text-[11px] text-muted-foreground">
                      {f.semantic_type}
                    </td>
                    <td className="px-3 py-2 font-mono text-[11px] text-muted-foreground">
                      {f.data_source ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-center">
                      {f.required && (
                        <CheckCircle2 className="size-3.5 text-foreground inline" />
                      )}
                    </td>
                    <td className="px-3 py-2 text-center">
                      {f.period_specific && (
                        <span className="text-[10px] text-muted-foreground">
                          •
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
