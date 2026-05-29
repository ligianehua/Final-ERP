"use client"

import { useEffect, useState } from "react"
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
import { Loader2, Plus, Pencil } from "lucide-react"
import {
  PERSON_ROLE_LABELS,
  type PersonRoleValue,
} from "@/lib/validations/person"
import type { CompanyPerson } from "@/types"

type FormState = {
  full_name: string
  role: PersonRoleValue
  position_title: string
  tin: string
  sss_no: string
  philhealth_no: string
  pagibig_no: string
  email: string
  phone: string
}

const EMPTY: FormState = {
  full_name: "",
  role: "officer",
  position_title: "",
  tin: "",
  sss_no: "",
  philhealth_no: "",
  pagibig_no: "",
  email: "",
  phone: "",
}

function fromPerson(p: CompanyPerson): FormState {
  return {
    full_name: p.full_name ?? "",
    role: p.role,
    position_title: p.position_title ?? "",
    tin: p.tin ?? "",
    sss_no: p.sss_no ?? "",
    philhealth_no: p.philhealth_no ?? "",
    pagibig_no: p.pagibig_no ?? "",
    email: p.email ?? "",
    phone: p.phone ?? "",
  }
}

export function PersonFormDialog({
  companyId,
  person,
  trigger,
}: {
  companyId: string
  person?: CompanyPerson
  trigger?: React.ReactNode
}) {
  const router = useRouter()
  const isEdit = !!person
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<FormState>(person ? fromPerson(person) : EMPTY)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setForm(person ? fromPerson(person) : EMPTY)
      setError(null)
    }
  }, [open, person])

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const payload = Object.fromEntries(
      Object.entries(form).map(([k, v]) => {
        if (k === "role") return [k, v]
        if (typeof v === "string" && v.trim() === "") return [k, null]
        return [k, typeof v === "string" ? v.trim() : v]
      })
    )

    const url = isEdit ? `/api/people/${person!.id}` : `/api/companies/${companyId}/people`
    const method = isEdit ? "PATCH" : "POST"

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })

    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setError(data.error || "Save failed")
      setLoading(false)
      return
    }

    setOpen(false)
    setLoading(false)
    router.refresh()
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size="sm" className="gap-2">
            {isEdit ? <Pencil className="size-4" /> : <Plus className="size-4" />}
            {isEdit ? "Edit" : "Add person"}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit person" : "Add person"}</DialogTitle>
          <DialogDescription>
            Anyone whose details might appear on a form — owner, officer, employee, or authorized signer.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="full_name">Full name *</Label>
              <Input
                id="full_name"
                required
                value={form.full_name}
                onChange={(e) => set("full_name", e.target.value)}
                placeholder="Juan dela Cruz"
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="role">Role</Label>
              <select
                id="role"
                value={form.role}
                onChange={(e) => set("role", e.target.value as PersonRoleValue)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {Object.entries(PERSON_ROLE_LABELS).map(([v, label]) => (
                  <option key={v} value={v}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="position_title">Position / title</Label>
            <Input
              id="position_title"
              value={form.position_title}
              onChange={(e) => set("position_title", e.target.value)}
              placeholder="President, Treasurer, HR Manager..."
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
              <Label htmlFor="sss_no">SSS No.</Label>
              <Input
                id="sss_no"
                value={form.sss_no}
                onChange={(e) => set("sss_no", e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
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

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={form.email}
                onChange={(e) => set("email", e.target.value)}
                placeholder="person@example.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                value={form.phone}
                onChange={(e) => set("phone", e.target.value)}
                placeholder="+63 917 ..."
              />
            </div>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <Button type="submit" disabled={loading} className="gap-2">
              {loading && <Loader2 className="size-4 animate-spin" />}
              {isEdit ? "Save changes" : "Add person"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
