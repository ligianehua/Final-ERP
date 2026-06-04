"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Loader2, Pencil } from "lucide-react"
import type { Company } from "@/types"

type FormState = {
  name: string
  tin: string
  sec_no: string
  dti_no: string
  address: string
  city: string
  phone: string
  email: string
  vat_status: string
  sss_no: string
  philhealth_no: string
  pagibig_no: string
}

function initialState(c: Company): FormState {
  return {
    name: c.name ?? "",
    tin: c.tin ?? "",
    sec_no: c.sec_no ?? "",
    dti_no: c.dti_no ?? "",
    address: c.address ?? "",
    city: c.city ?? "",
    phone: c.phone ?? "",
    email: c.email ?? "",
    vat_status: c.vat_status ?? "",
    sss_no: c.sss_no ?? "",
    philhealth_no: c.philhealth_no ?? "",
    pagibig_no: c.pagibig_no ?? "",
  }
}

export function EditCompanyDialog({ company }: { company: Company }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<FormState>(initialState(company))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const isIndividual = company.entity_type === "individual"

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    // Convert empty strings to null so the API stores NULL, not ""
    const payload = Object.fromEntries(
      Object.entries(form).map(([k, v]) => [k, v.trim() === "" ? null : v.trim()])
    )

    const res = await fetch(`/api/companies/${company.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })

    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setError(data.error || "Failed to save")
      setLoading(false)
      return
    }

    setOpen(false)
    setLoading(false)
    router.refresh()
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o)
        if (o) {
          setForm(initialState(company))
          setError(null)
        }
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Pencil className="size-4" />
          Edit
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit profile</DialogTitle>
          <DialogDescription>
            Update fields manually. AI extraction will fill these from uploaded documents (Week 3).
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">{isIndividual ? "Full name" : "Company name"}</Label>
            <Input
              id="name"
              required
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="tin">TIN</Label>
              <Input
                id="tin"
                value={form.tin}
                onChange={(e) => set("tin", e.target.value)}
                placeholder="123-456-789-000"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="vat_status">VAT status</Label>
              <select
                id="vat_status"
                value={form.vat_status}
                onChange={(e) => set("vat_status", e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="">Not set</option>
                <option value="vat_registered">VAT Registered</option>
                <option value="non_vat">Non-VAT</option>
              </select>
            </div>
          </div>

          {!isIndividual && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="sec_no">SEC No.</Label>
                <Input
                  id="sec_no"
                  value={form.sec_no}
                  onChange={(e) => set("sec_no", e.target.value)}
                  placeholder="CS201812345"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dti_no">DTI No.</Label>
                <Input
                  id="dti_no"
                  value={form.dti_no}
                  onChange={(e) => set("dti_no", e.target.value)}
                  placeholder="DTI-1234567"
                />
              </div>
            </div>
          )}

          {isIndividual && (
            <div className="space-y-2">
              <Label htmlFor="dti_no">DTI No.</Label>
              <Input
                id="dti_no"
                value={form.dti_no}
                onChange={(e) => set("dti_no", e.target.value)}
                placeholder="DTI-1234567"
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="address">Address</Label>
            <Input
              id="address"
              value={form.address}
              onChange={(e) => set("address", e.target.value)}
              placeholder="123 Ayala Ave, Makati"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="city">City</Label>
              <Input
                id="city"
                value={form.city}
                onChange={(e) => set("city", e.target.value)}
                placeholder="Makati City"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                value={form.phone}
                onChange={(e) => set("phone", e.target.value)}
                placeholder="+63 2 1234 5678"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={form.email}
              onChange={(e) => set("email", e.target.value)}
              placeholder="info@example.com"
            />
          </div>

          {isIndividual && (
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="sss_no">SSS No.</Label>
                <Input
                  id="sss_no"
                  value={form.sss_no}
                  onChange={(e) => set("sss_no", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="philhealth_no">PhilHealth</Label>
                <Input
                  id="philhealth_no"
                  value={form.philhealth_no}
                  onChange={(e) => set("philhealth_no", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pagibig_no">Pag-IBIG</Label>
                <Input
                  id="pagibig_no"
                  value={form.pagibig_no}
                  onChange={(e) => set("pagibig_no", e.target.value)}
                />
              </div>
            </div>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <Button type="submit" disabled={loading} className="gap-2">
              {loading && <Loader2 className="size-4 animate-spin" />}
              Save changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
