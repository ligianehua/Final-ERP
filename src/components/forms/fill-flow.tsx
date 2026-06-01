"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { CheckCircle2, AlertCircle, Loader2, Save, Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"
import { FormEditorOverlay } from "./form-editor-overlay"
import type {
  CoordSpec,
  FieldOverrides,
  TemplateConfig,
} from "@/lib/forms/template-types"

type SerializableTemplate = Omit<TemplateConfig, "transformValues">


type FilledField = {
  id: string
  label: string
  semantic_type: string
  value: string | null
  source: string | null
  confidence: number
  period_specific: boolean
  required: boolean
  placeholder?: string
  hint?: string
}

const VAT_STATUS_LABELS: Record<string, string> = {
  vat_registered: "VAT Registered",
  non_vat: "Non-VAT",
}

type FillResponse = {
  form: { form_code: string; form_name: string; agency: string }
  company: { id: string; name: string; entity_type: string }
  people: Array<{ id: string; full_name: string; role: string; position_title: string | null }>
  signatory_id: string | null
  fields: FilledField[]
}

type CompanyOption = { id: string; name: string; entity_type: string }

export type InitialSubmission = {
  id: string
  companyId: string
  period: string
  values: Record<string, string>
  overrides: FieldOverrides
}

export function FillFlow({
  formCode,
  template,
  isAdmin,
  initial,
}: {
  formCode: string
  template: SerializableTemplate | null
  isAdmin: boolean
  initial?: InitialSubmission
}) {
  const router = useRouter()
  const [companies, setCompanies] = useState<CompanyOption[] | null>(null)
  const [companyId, setCompanyId] = useState<string>(initial?.companyId ?? "")
  const [signatoryId, setSignatoryId] = useState<string | null>(null)
  const [data, setData] = useState<FillResponse | null>(null)
  const [values, setValues] = useState<Record<string, string>>(
    initial?.values ?? {},
  )
  const [overrides, setOverrides] = useState<FieldOverrides>(
    initial?.overrides ?? {},
  )
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [period, setPeriod] = useState<string>(() => {
    if (initial?.period) return initial.period
    // Default to previous month (typical filing window)
    const d = new Date()
    d.setMonth(d.getMonth() - 1)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
  })

  // Load companies once
  useEffect(() => {
    let active = true
    fetch("/api/companies")
      .then((r) => r.json())
      .then((json) => {
        if (!active) return
        setCompanies(json.companies ?? [])
      })
      .catch(() => setCompanies([]))
    return () => {
      active = false
    }
  }, [])

  // Edit mode: load form meta on mount, preserve our saved values.
  useEffect(() => {
    if (!initial) return
    runFill(initial.companyId, null, initial.values)
    // initial is stable for the lifetime of this mount; deps intentionally
    // empty so we only seed once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Sync top "Period (YYYY-MM)" → the form's For the Month / For the Year fields.
  // Fires on initial fill and whenever the user changes the period.
  useEffect(() => {
    if (!data) return
    const match = period.match(/^(\d{4})-(\d{1,2})$/)
    if (!match) return
    const yyyy = match[1]
    const mm = match[2].padStart(2, "0")
    setValues((v) => {
      if (v.period_year === yyyy && v.period_month === mm) return v
      return { ...v, period_year: yyyy, period_month: mm }
    })
  }, [period, data])

  async function runFill(
    cid: string,
    sid: string | null = null,
    preserveValues: Record<string, string> | null = null,
  ) {
    setLoading(true)
    setError(null)
    setData(null)
    const res = await fetch("/api/forms/fill", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ form_code: formCode, company_id: cid, signatory_id: sid }),
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) {
      setError(json.error || "Fill failed")
      setLoading(false)
      return
    }
    setData(json)
    setSignatoryId(json.signatory_id)
    if (preserveValues) {
      setValues(preserveValues)
    } else {
      const init: Record<string, string> = {}
      for (const f of json.fields as FilledField[]) {
        init[f.id] = f.value ?? ""
      }
      setValues(init)
    }
    setLoading(false)
  }

  function setVal(id: string, v: string) {
    setValues((s) => ({ ...s, [id]: v }))
  }

  function setOverride(
    id: string,
    next: { dx: number; dy: number } | null,
  ) {
    setOverrides((s) => {
      if (!next) {
        const { [id]: _, ...rest } = s
        return rest
      }
      return { ...s, [id]: next }
    })
  }

  // Admin only: bake the current overrides into the template as the new
  // default for everyone, then clear them locally. Returns a status
  // message rendered by the editor.
  async function saveAsTemplate(): Promise<{ ok: boolean; message: string }> {
    if (!template || template.mapping.strategy !== "coordinates") {
      return { ok: false, message: "Template not editable" }
    }
    if (Object.keys(overrides).length === 0) {
      return { ok: false, message: "Nothing to save — drag a field first" }
    }
    const merged: Record<string, CoordSpec> = {}
    for (const [id, spec] of Object.entries(template.mapping.fields)) {
      const o = overrides[id]
      merged[id] = o ? { ...spec, x: spec.x + o.dx, y: spec.y + o.dy } : spec
    }
    const res = await fetch(`/api/forms/templates/${formCode}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ field_mapping: merged }),
    })
    if (!res.ok) {
      const json = await res.json().catch(() => ({}))
      return { ok: false, message: json.error || "Save failed" }
    }
    // Wipe locally — they're now baked into the next page-render's template.
    setOverrides({})
    router.refresh()
    return { ok: true, message: "Saved as new default" }
  }

  async function changeSignatory(newId: string) {
    if (!companyId) return
    await runFill(companyId, newId || null)
  }

  async function saveDraft() {
    if (!data) return
    setSaving(true)
    setError(null)

    const field_values: Record<string, string | null> = {}
    for (const [k, v] of Object.entries(values)) {
      field_values[k] = v.trim() === "" ? null : v
    }

    const editing = !!initial
    const url = editing ? `/api/submissions/${initial.id}` : "/api/submissions"
    const method = editing ? "PATCH" : "POST"
    const body = editing
      ? { period, field_values, field_overrides: overrides }
      : {
          form_code: formCode,
          company_id: data.company.id,
          period,
          field_values,
          field_overrides: overrides,
        }

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) {
      setError(json.error || "Save failed")
      setSaving(false)
      return
    }
    setSaving(false)
    router.push("/submissions")
    router.refresh()
  }

  const summary = useMemo(() => {
    if (!data) return { filled: 0, missingRequired: 0, total: 0 }
    let filled = 0
    let missingRequired = 0
    for (const f of data.fields) {
      const v = values[f.id]
      const has = v && v.trim() !== ""
      if (has) filled++
      if (!has && f.required) missingRequired++
    }
    return { filled, missingRequired, total: data.fields.length }
  }, [data, values])

  // Step 1: pick company
  if (!data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Choose an archive to fill from</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {companies === null ? (
            <Loader2 className="size-5 animate-spin" />
          ) : companies.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              You have no archives yet. Create a company or individual first.
            </p>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="company">Archive</Label>
                <select
                  id="company"
                  value={companyId}
                  onChange={(e) => setCompanyId(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="">Select…</option>
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.entity_type === "individual" ? "Individual" : "Company"})
                    </option>
                  ))}
                </select>
              </div>

              {error && <p className="text-sm text-destructive">{error}</p>}

              <Button
                onClick={() => companyId && runFill(companyId)}
                disabled={!companyId || loading}
                className="gap-2 w-full"
              >
                {loading ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Filling from archive…
                  </>
                ) : (
                  <>
                    <Sparkles className="size-4" />
                    Fill from archive
                  </>
                )}
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    )
  }

  // Step 2: review filled fields
  return (
    <div className="space-y-6">
      {/* Summary bar */}
      <Card>
        <CardContent className="py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm">
              <span className="font-medium">{data.form.form_name}</span>{" "}
              <span className="text-muted-foreground">for {data.company.name}</span>
            </div>
            <div className="flex gap-3 text-xs">
              <span className="inline-flex items-center gap-1 text-green-700">
                <CheckCircle2 className="size-3.5" /> {summary.filled} filled
              </span>
              {summary.missingRequired > 0 && (
                <span className="inline-flex items-center gap-1 text-destructive">
                  <AlertCircle className="size-3.5" /> {summary.missingRequired} required missing
                </span>
              )}
              <span className="text-muted-foreground">of {summary.total} total</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Period + signatory */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filing meta</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="period">Period (YYYY-MM)</Label>
            <Input
              id="period"
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              placeholder="2026-05"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="signatory">Signatory</Label>
            <select
              id="signatory"
              value={signatoryId ?? ""}
              onChange={(e) => {
                const v = e.target.value || null
                setSignatoryId(v)
                changeSignatory(v ?? "")
              }}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="">— None —</option>
              {data.people.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.full_name} · {p.role}
                  {p.position_title ? ` (${p.position_title})` : ""}
                </option>
              ))}
            </select>
          </div>
        </CardContent>
      </Card>

      {(() => {
        const useVisualEditor =
          template && template.mapping.strategy === "coordinates"

        // Which schema field ids are covered by the visual editor?
        // (period_display is virtual — it covers period_month + period_year.)
        const covered = new Set<string>()
        if (useVisualEditor) {
          for (const k of Object.keys(template.mapping.fields)) {
            if (k === "period_display") {
              covered.add("period_month")
              covered.add("period_year")
            } else {
              covered.add(k)
            }
          }
        }

        const orphans = useVisualEditor
          ? data.fields.filter((f) => !covered.has(f.id))
          : data.fields

        return (
          <>
            {useVisualEditor && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Edit on the form</CardTitle>
                  <p className="text-xs text-muted-foreground">
                    Click any value to edit. Yellow tint = focused cell.
                    Required-empty cells show a red ring.
                  </p>
                </CardHeader>
                <CardContent>
                  <FormEditorOverlay
                    formCode={formCode}
                    template={template}
                    fields={data.fields.map((f) => ({
                      id: f.id,
                      label: f.label,
                      required: f.required,
                    }))}
                    values={values}
                    onChange={setVal}
                    overrides={overrides}
                    onOverrideChange={setOverride}
                    isAdmin={isAdmin}
                    onSaveAsTemplate={saveAsTemplate}
                  />
                </CardContent>
              </Card>
            )}

            {orphans.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">
                    {useVisualEditor
                      ? "Other fields not on the printed form"
                      : "Form fields"}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {orphans.map((f) => {
                    const v = values[f.id] ?? ""
                    const filled = v.trim() !== ""
                    const fromArchive =
                      f.source && filled && (values[f.id] === (f.value ?? ""))
                    const isVatStatus = f.semantic_type === "company_vat_status"
                    return (
                      <div key={f.id} className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <Label
                            htmlFor={f.id}
                            className="flex items-center gap-2"
                          >
                            {f.label}
                            {f.required && (
                              <span className="text-destructive">*</span>
                            )}
                          </Label>
                          <div className="flex items-center gap-2 text-xs">
                            {f.period_specific && (
                              <span className="text-muted-foreground">period</span>
                            )}
                            {fromArchive && (
                              <span className="text-green-700 inline-flex items-center gap-1">
                                <CheckCircle2 className="size-3" /> from archive
                              </span>
                            )}
                            {!filled && f.required && (
                              <span className="text-destructive">required</span>
                            )}
                          </div>
                        </div>
                        {isVatStatus ? (
                          <select
                            id={f.id}
                            value={v}
                            onChange={(e) => setVal(f.id, e.target.value)}
                            className={cn(
                              "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                              !filled &&
                                f.required &&
                                "border-destructive/40 focus-visible:ring-destructive/30",
                            )}
                          >
                            <option value="">— Not set —</option>
                            <option value="vat_registered">
                              {VAT_STATUS_LABELS.vat_registered}
                            </option>
                            <option value="non_vat">
                              {VAT_STATUS_LABELS.non_vat}
                            </option>
                          </select>
                        ) : (
                          <Input
                            id={f.id}
                            value={v}
                            onChange={(e) => setVal(f.id, e.target.value)}
                            placeholder={f.placeholder || ""}
                            className={cn(
                              !filled &&
                                f.required &&
                                "border-destructive/40 focus-visible:ring-destructive/30",
                            )}
                          />
                        )}
                        {f.hint && (
                          <p className="text-xs text-muted-foreground">{f.hint}</p>
                        )}
                      </div>
                    )
                  })}
                </CardContent>
              </Card>
            )}
          </>
        )
      })()}

      {error && (
        <p className="text-sm text-destructive border border-destructive/30 rounded-md p-3">
          {error}
        </p>
      )}

      <div className="flex justify-end gap-2">
        {!initial && (
          <Button variant="outline" onClick={() => setData(null)} disabled={saving}>
            Start over
          </Button>
        )}
        {initial && (
          <Button
            variant="outline"
            onClick={() => router.push("/submissions")}
            disabled={saving}
          >
            Cancel
          </Button>
        )}
        <Button onClick={saveDraft} disabled={saving} className="gap-2">
          {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
          {initial ? "Update draft" : "Save draft"}
        </Button>
      </div>
    </div>
  )
}
