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
import { Loader2, Plus } from "lucide-react"

export function CreateCompanyDialog() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const formData = new FormData(e.currentTarget)
    const payload = {
      name: formData.get("name") as string,
      tin: (formData.get("tin") as string) || null,
      sec_no: (formData.get("sec_no") as string) || null,
      dti_no: (formData.get("dti_no") as string) || null,
      address: (formData.get("address") as string) || null,
      city: (formData.get("city") as string) || null,
      phone: (formData.get("phone") as string) || null,
      email: (formData.get("email") as string) || null,
      vat_status: (formData.get("vat_status") as string) || null,
    }

    const res = await fetch("/api/companies", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })

    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setError(data.error || "Failed to create company")
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
        <Button className="gap-2">
          <Plus className="size-4" />
          New company
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New company</DialogTitle>
          <DialogDescription>
            Add a company to your archive. Only the name is required — fill the rest anytime.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="space-y-2">
            <Label htmlFor="name">Company name *</Label>
            <Input id="name" name="name" required placeholder="ABC Trading Corporation" autoFocus />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="tin">TIN</Label>
              <Input id="tin" name="tin" placeholder="123-456-789-000" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="vat_status">VAT status</Label>
              <select
                id="vat_status"
                name="vat_status"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                defaultValue=""
              >
                <option value="">Not set</option>
                <option value="vat_registered">VAT Registered</option>
                <option value="non_vat">Non-VAT</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="sec_no">SEC No.</Label>
              <Input id="sec_no" name="sec_no" placeholder="CS201812345" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dti_no">DTI No.</Label>
              <Input id="dti_no" name="dti_no" placeholder="DTI-1234567" />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="address">Address</Label>
            <Input id="address" name="address" placeholder="123 Ayala Ave, Makati" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="city">City</Label>
              <Input id="city" name="city" placeholder="Makati City" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" name="phone" placeholder="+63 2 1234 5678" />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" placeholder="info@company.com" />
          </div>

          <DialogFooter>
            <Button type="submit" disabled={loading} className="gap-2">
              {loading && <Loader2 className="size-4 animate-spin" />}
              Create company
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
