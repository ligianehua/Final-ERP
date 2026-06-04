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
import { cn } from "@/lib/utils"
import { Building2, Loader2, Plus, User } from "lucide-react"
import type { EntityType } from "@/types"

export function CreateCompanyDialog() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [entityType, setEntityType] = useState<EntityType>("company")
  const [name, setName] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function reset() {
    setEntityType("company")
    setName("")
    setError(null)
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const res = await fetch("/api/companies", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entity_type: entityType, name: name.trim() }),
    })

    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setError(data.error || "Failed to create")
      setLoading(false)
      return
    }

    setOpen(false)
    reset()
    setLoading(false)
    router.refresh()
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o)
        if (!o) reset()
      }}
    >
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Plus className="size-4" />
          New
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New archive</DialogTitle>
          <DialogDescription>
            Choose a type and give it a name. You can upload documents to fill the rest later.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <Label>Type</Label>
            <div className="grid grid-cols-2 gap-3">
              <EntityTypeButton
                active={entityType === "individual"}
                onClick={() => setEntityType("individual")}
                icon={<User className="size-5" />}
                label="Individual"
                hint="Sole proprietor"
              />
              <EntityTypeButton
                active={entityType === "company"}
                onClick={() => setEntityType("company")}
                icon={<Building2 className="size-5" />}
                label="Company"
                hint="Corporation, partnership"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="name">
              {entityType === "individual" ? "Full name" : "Company name"}
            </Label>
            <Input
              id="name"
              required
              placeholder={
                entityType === "individual"
                  ? "Juan dela Cruz"
                  : "ABC Trading Corporation"
              }
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <Button type="submit" disabled={loading || !name.trim()} className="gap-2">
              {loading && <Loader2 className="size-4 animate-spin" />}
              Create
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function EntityTypeButton({
  active,
  onClick,
  icon,
  label,
  hint,
}: {
  active: boolean
  onClick: () => void
  icon: React.ReactNode
  label: string
  hint: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex flex-col items-start gap-1 rounded-lg border p-4 text-left transition-colors",
        active
          ? "border-foreground bg-secondary"
          : "border-border hover:border-foreground/30"
      )}
    >
      <div className="flex items-center gap-2">
        {icon}
        <span className="font-medium text-sm">{label}</span>
      </div>
      <span className="text-xs text-muted-foreground">{hint}</span>
    </button>
  )
}
