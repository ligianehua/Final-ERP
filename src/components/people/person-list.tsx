"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { PersonFormDialog } from "@/components/forms/person-form-dialog"
import { User, Trash2, Loader2 } from "lucide-react"
import { PERSON_ROLE_LABELS } from "@/lib/validations/person"
import type { CompanyPerson } from "@/types"

export function PersonList({
  people,
  companyId,
}: {
  people: CompanyPerson[]
  companyId: string
}) {
  if (people.length === 0) {
    return (
      <div className="border border-dashed border-border rounded-lg p-8 text-center">
        <User className="size-6 text-muted-foreground mx-auto mb-2" />
        <p className="text-sm text-muted-foreground">
          No people yet. Add officers, employees, or authorized representatives.
        </p>
      </div>
    )
  }

  return (
    <ul className="divide-y divide-border border border-border rounded-lg">
      {people.map((p) => (
        <PersonRow key={p.id} person={p} companyId={companyId} />
      ))}
    </ul>
  )
}

function PersonRow({ person, companyId }: { person: CompanyPerson; companyId: string }) {
  const router = useRouter()
  const [deleting, setDeleting] = useState(false)

  async function remove() {
    if (!confirm(`Delete ${person.full_name}?`)) return
    setDeleting(true)
    const res = await fetch(`/api/people/${person.id}`, { method: "DELETE" })
    if (res.ok) {
      router.refresh()
    } else {
      setDeleting(false)
      alert("Delete failed.")
    }
  }

  const idTags = [
    person.tin && { label: "TIN", value: person.tin },
    person.sss_no && { label: "SSS", value: person.sss_no },
    person.philhealth_no && { label: "PhilHealth", value: person.philhealth_no },
    person.pagibig_no && { label: "Pag-IBIG", value: person.pagibig_no },
  ].filter(Boolean) as Array<{ label: string; value: string }>

  return (
    <li className="flex items-start gap-3 p-3">
      <div className="size-10 rounded-full bg-secondary flex items-center justify-center shrink-0">
        <User className="size-5 text-foreground" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-2">
          <p className="text-sm font-medium">{person.full_name}</p>
          <span className="text-xs text-muted-foreground border border-border rounded px-1.5 py-0.5">
            {PERSON_ROLE_LABELS[person.role]}
          </span>
          {person.position_title && (
            <span className="text-xs text-muted-foreground">{person.position_title}</span>
          )}
        </div>
        {idTags.length > 0 && (
          <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1 text-xs text-muted-foreground">
            {idTags.map((t) => (
              <span key={t.label}>
                {t.label}: <span className="text-foreground">{t.value}</span>
              </span>
            ))}
          </div>
        )}
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <PersonFormDialog
          companyId={companyId}
          person={person}
          trigger={
            <Button variant="ghost" size="sm">
              Edit
            </Button>
          }
        />
        <Button
          variant="ghost"
          size="icon"
          onClick={remove}
          disabled={deleting}
          title="Delete"
          className="text-destructive hover:text-destructive"
        >
          {deleting ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Trash2 className="size-4" />
          )}
        </Button>
      </div>
    </li>
  )
}
