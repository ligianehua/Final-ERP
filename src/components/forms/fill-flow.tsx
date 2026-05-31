"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { CheckCircle2, AlertCircle, Loader2, Save, Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"

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

export function FillFlow({ formCode }: { formCode: string }) {
  const router = useRouter()
  const [companies, setCompanies] = useState<CompanyOption[] | null>(null)
  const [companyId, setCompanyId] = useState<string>("")
  const [signatoryId, setSignatoryId] = useState<string | null>(null)
  const [data, setData] = useState<FillResponse | null>(null)
  const [values, setValues] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [period, setPeriod] = useState<string>(() => {
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

  async function runFill(cid: string, sid: string | null = null) {
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
    const init: Record<string, string> = {}
    for (const f of json.fields as FilledField[]) {
      init[f.id] = f.value ?? ""
    }
    setValues(init)
    setLoading(false)
  }

  function setVal(id: string, v: string) {
    setValues((s) => ({ ...s, [id]: v }))
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

    const res = await fetch("/api/submissions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        form_code: formCode,
        company_id: data.company.id,
        period,
        field_values,
      }),
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) {
      setError(json.error || "Save failed")
      setSaving(false)
      return
    }
    setSaving(false)
    router.push("/submissions")
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

      {/* Fields */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Form fields</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {data.fields.map((f) => {
            const v = values[f.id] ?? ""
            const filled = v.trim() !== ""
            const fromArchive = f.source && filled && (values[f.id] === (f.value ?? ""))
            const isVatStatus = f.semantic_type === "company_vat_status"
            return (
              <div key={f.id} className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor={f.id} className="flex items-center gap-2">
                    {f.label}
                    {f.required && <span className="text-destructive">*</span>}
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
                      !filled && f.required && "border-destructive/40 focus-visible:ring-destructive/30"
                    )}
                  >
                    <option value="">— Not set —</option>
                    <option value="vat_registered">{VAT_STATUS_LABELS.vat_registered}</option>
                    <option value="non_vat">{VAT_STATUS_LABELS.non_vat}</option>
                  </select>
                ) : (
                  <Input
                    id={f.id}
                    value={v}
                    onChange={(e) => setVal(f.id, e.target.value)}
                    placeholder={f.placeholder || ""}
                    className={cn(
                      !filled && f.required && "border-destructive/40 focus-visible:ring-destructive/30"
                    )}
                  />
                )}
                {f.hint && <p className="text-xs text-muted-foreground">{f.hint}</p>}
              </div>
            )
          })}
        </CardContent>
      </Card>

      {error && (
        <p className="text-sm text-destructive border border-destructive/30 rounded-md p-3">
          {error}
        </p>
      )}

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={() => setData(null)} disabled={saving}>
          Start over
        </Button>
        <Button onClick={saveDraft} disabled={saving} className="gap-2">
          {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
          Save draft
        </Button>
      </div>
    </div>
  )
}
