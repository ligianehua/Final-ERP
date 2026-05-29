"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Loader2, Sparkles } from "lucide-react"
import type { Company } from "@/types"

type Extracted = {
  document_type: string | null
  document_number: string | null
  issued_date: string | null
  expiry_date: string | null
  issuing_authority: string | null
  subject_name: string | null
  tin: string | null
  sec_no: string | null
  dti_no: string | null
  sss_no: string | null
  philhealth_no: string | null
  pagibig_no: string | null
  address: string | null
  city: string | null
  phone: string | null
  email: string | null
  vat_status: "vat_registered" | "non_vat" | null
}

// Fields that can be applied back to the company/individual profile.
// (document_type / numbers / dates live on the document row itself.)
const PROFILE_FIELDS: Array<{ key: keyof Extracted; label: string; companyKey: keyof Company }> = [
  { key: "subject_name", label: "Name", companyKey: "name" },
  { key: "tin", label: "TIN", companyKey: "tin" },
  { key: "sec_no", label: "SEC No.", companyKey: "sec_no" },
  { key: "dti_no", label: "DTI No.", companyKey: "dti_no" },
  { key: "sss_no", label: "SSS No.", companyKey: "sss_no" },
  { key: "philhealth_no", label: "PhilHealth No.", companyKey: "philhealth_no" },
  { key: "pagibig_no", label: "Pag-IBIG No.", companyKey: "pagibig_no" },
  { key: "address", label: "Address", companyKey: "address" },
  { key: "city", label: "City", companyKey: "city" },
  { key: "phone", label: "Phone", companyKey: "phone" },
  { key: "email", label: "Email", companyKey: "email" },
  { key: "vat_status", label: "VAT status", companyKey: "vat_status" },
]

export function ExtractionResultsDialog({
  open,
  onOpenChange,
  extracted,
  company,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  extracted: Extracted | null
  company: Company
}) {
  const router = useRouter()
  const [applying, setApplying] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Each suggestable field is selected by default if it has a value
  const suggestions = useMemo(
    () =>
      extracted
        ? PROFILE_FIELDS.filter((f) => extracted[f.key] != null && extracted[f.key] !== "")
        : [],
    [extracted]
  )

  const [selected, setSelected] = useState<Record<string, boolean>>({})

  // When a fresh extraction arrives, default every suggested field to checked.
  useEffect(() => {
    if (!extracted) return
    const init: Record<string, boolean> = {}
    for (const f of suggestions) init[f.key] = true
    setSelected(init)
  }, [extracted, suggestions])

  async function applySelected() {
    if (!extracted) return
    setApplying(true)
    setError(null)

    const payload: Record<string, string | null> = {}
    for (const f of suggestions) {
      if (!selected[f.key]) continue
      payload[f.companyKey as string] = extracted[f.key] as string | null
    }

    if (Object.keys(payload).length === 0) {
      onOpenChange(false)
      setApplying(false)
      return
    }

    const res = await fetch(`/api/companies/${company.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })

    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setError(data.error || "Failed to apply changes.")
      setApplying(false)
      return
    }

    onOpenChange(false)
    setSelected({})
    setApplying(false)
    router.refresh()
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o)
        if (!o) {
          setSelected({})
          setError(null)
        }
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="size-5" />
            Extraction results
          </DialogTitle>
          <DialogDescription>
            Review what the AI found. Uncheck anything that looks wrong, then apply to profile.
          </DialogDescription>
        </DialogHeader>

        {!extracted ? (
          <p className="text-sm text-muted-foreground">No data extracted.</p>
        ) : suggestions.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            The AI couldn&apos;t find any profile fields in this document.
          </p>
        ) : (
          <div className="space-y-3">
            {suggestions.map((f) => {
              const value = extracted[f.key] as string | null
              const current = company[f.companyKey] as string | null | undefined
              const isReplace = current && current !== value
              return (
                <label
                  key={f.key}
                  className="flex items-start gap-3 p-3 border border-border rounded-md hover:bg-secondary/30 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={!!selected[f.key]}
                    onChange={(e) =>
                      setSelected((s) => ({ ...s, [f.key]: e.target.checked }))
                    }
                    className="mt-1"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium">{f.label}</div>
                    <div className="text-sm text-foreground mt-0.5 truncate">{value}</div>
                    {isReplace && (
                      <div className="text-xs text-muted-foreground mt-1">
                        Will replace: <span className="line-through">{current}</span>
                      </div>
                    )}
                  </div>
                </label>
              )
            })}
          </div>
        )}

        {error && <p className="text-sm text-destructive mt-2">{error}</p>}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={applying}>
            Cancel
          </Button>
          <Button
            onClick={applySelected}
            disabled={applying || suggestions.length === 0}
            className="gap-2"
          >
            {applying && <Loader2 className="size-4 animate-spin" />}
            Apply to profile
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function buildEmptyExtraction(): Extracted {
  return {
    document_type: null,
    document_number: null,
    issued_date: null,
    expiry_date: null,
    issuing_authority: null,
    subject_name: null,
    tin: null,
    sec_no: null,
    dti_no: null,
    sss_no: null,
    philhealth_no: null,
    pagibig_no: null,
    address: null,
    city: null,
    phone: null,
    email: null,
    vat_status: null,
  }
}

export type { Extracted as ExtractionData }
