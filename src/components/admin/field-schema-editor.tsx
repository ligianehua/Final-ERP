"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import {
  CheckCircle2,
  Loader2,
  Plus,
  Save,
  Trash2,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { toast } from "@/components/ui/toaster"

export type SchemaField = {
  id: string
  label: string
  semantic_type: string
  data_source: string | null
  required: boolean
  period_specific: boolean
}

const SEMANTIC_TYPES = [
  "company_name",
  "company_tin",
  "company_sec_no",
  "company_dti_no",
  "company_address",
  "company_city",
  "company_phone",
  "company_email",
  "company_vat_status",
  "period_month",
  "period_year",
  "amount",
  "signatory_name",
  "signatory_tin",
  "signatory_position",
  "text",
]

const DATA_SOURCE_SUGGESTIONS = [
  "company.name",
  "company.tin",
  "company.sec_no",
  "company.dti_no",
  "company.address",
  "company.city",
  "company.phone",
  "company.email",
  "company.vat_status",
  "person.full_name",
  "person.tin",
  "person.position_title",
]

function slugify(label: string): string {
  return (
    label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 40) || "field"
  )
}

/**
 * `editable` adds a freshly-typed `id` for new fields so we can rename
 * them before the first save (after which the id is locked because the
 * coord map references it).
 */
type EditableField = SchemaField & {
  /** Was this field present in the original payload? */
  isOriginal: boolean
}

type Props = {
  formCode: string
  formName: string
  agency: string
  initialFields: SchemaField[]
}

export function FieldSchemaEditor({
  formCode,
  formName,
  agency,
  initialFields,
}: Props) {
  const router = useRouter()
  const [fields, setFields] = useState<EditableField[]>(() =>
    initialFields.map((f) => ({ ...f, isOriginal: true })),
  )
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<EditableField | null>(null)
  const [dirty, setDirty] = useState(false)

  function markDirty() {
    setDirty(true)
  }

  function update(i: number, patch: Partial<EditableField>) {
    setFields((prev) => {
      const next = [...prev]
      next[i] = { ...next[i], ...patch }
      return next
    })
    markDirty()
  }

  function addField() {
    setFields((prev) => [
      ...prev,
      {
        id: `field_${prev.length + 1}`,
        label: "New field",
        semantic_type: "text",
        data_source: null,
        required: false,
        period_specific: false,
        isOriginal: false,
      },
    ])
    markDirty()
  }

  function removeField(target: EditableField) {
    setFields((prev) => prev.filter((f) => f !== target))
    setConfirmDelete(null)
    markDirty()
  }

  async function save() {
    const ids = fields.map((f) => f.id)
    const dup = ids.find((id, i) => ids.indexOf(id) !== i)
    if (dup) {
      toast({
        variant: "destructive",
        title: "Duplicate field id",
        description: `"${dup}" is used by more than one field.`,
      })
      return
    }
    setSaving(true)
    const res = await fetch(
      `/api/forms/templates/${encodeURIComponent(formCode)}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          field_schema: {
            form_code: formCode,
            form_name: formName,
            agency,
            fields: fields.map((f) => ({
              id: f.id,
              label: f.label,
              semantic_type: f.semantic_type,
              data_source: f.data_source,
              required: f.required,
              period_specific: f.period_specific,
            })),
          },
        }),
      },
    )
    setSaving(false)
    if (!res.ok) {
      const json = await res.json().catch(() => ({}))
      toast({
        variant: "destructive",
        title: "Save failed",
        description: json.error ?? "Try again.",
      })
      return
    }
    toast({
      variant: "success",
      title: "Fields saved",
      description: `${fields.length} field${fields.length === 1 ? "" : "s"} in this template.`,
    })
    setDirty(false)
    setFields((prev) => prev.map((f) => ({ ...f, isOriginal: true })))
    router.refresh()
  }

  return (
    <div className="space-y-3">
      <div className="border rounded-md overflow-hidden">
        <table className="w-full text-xs">
          <thead className="bg-muted/40 text-muted-foreground">
            <tr>
              <th className="text-left px-3 py-2 font-medium w-[160px]">ID</th>
              <th className="text-left px-3 py-2 font-medium">Label</th>
              <th className="text-left px-3 py-2 font-medium w-[160px]">Semantic</th>
              <th className="text-left px-3 py-2 font-medium w-[170px]">Data source</th>
              <th className="text-center px-3 py-2 font-medium w-[60px]">Req</th>
              <th className="text-center px-3 py-2 font-medium w-[60px]">Period</th>
              <th className="w-8" />
            </tr>
          </thead>
          <tbody>
            {fields.map((f, i) => (
              <tr key={i} className="border-t">
                <td className="px-3 py-2 align-top">
                  <Input
                    value={f.id}
                    onChange={(e) => {
                      // Only allow id edits before first save (otherwise
                      // the coord map's reference would break).
                      if (f.isOriginal) return
                      update(i, { id: slugify(e.target.value) })
                    }}
                    readOnly={f.isOriginal}
                    className={cn(
                      "font-mono text-[11px] h-8",
                      f.isOriginal && "bg-muted/40 cursor-not-allowed",
                    )}
                  />
                </td>
                <td className="px-3 py-2 align-top">
                  <Input
                    value={f.label}
                    onChange={(e) => {
                      const nextLabel = e.target.value
                      // For new fields, auto-sync id off label until the
                      // admin types directly into the id box.
                      const patch: Partial<EditableField> = { label: nextLabel }
                      if (!f.isOriginal) {
                        patch.id = slugify(nextLabel)
                      }
                      update(i, patch)
                    }}
                    className="h-8"
                  />
                </td>
                <td className="px-3 py-2 align-top">
                  <select
                    value={f.semantic_type}
                    onChange={(e) =>
                      update(i, { semantic_type: e.target.value })
                    }
                    className="flex h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
                  >
                    {SEMANTIC_TYPES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-3 py-2 align-top">
                  <Input
                    list={`data-source-suggestions-${i}`}
                    value={f.data_source ?? ""}
                    onChange={(e) =>
                      update(i, { data_source: e.target.value || null })
                    }
                    placeholder="— None —"
                    className="font-mono text-[11px] h-8"
                  />
                  <datalist id={`data-source-suggestions-${i}`}>
                    {DATA_SOURCE_SUGGESTIONS.map((s) => (
                      <option key={s} value={s} />
                    ))}
                  </datalist>
                </td>
                <td className="px-3 py-2 align-top text-center">
                  <input
                    type="checkbox"
                    checked={f.required}
                    onChange={(e) => update(i, { required: e.target.checked })}
                    className="size-4"
                  />
                </td>
                <td className="px-3 py-2 align-top text-center">
                  <input
                    type="checkbox"
                    checked={f.period_specific}
                    onChange={(e) =>
                      update(i, { period_specific: e.target.checked })
                    }
                    className="size-4"
                  />
                </td>
                <td className="px-2 align-top pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (f.isOriginal) setConfirmDelete(f)
                      else removeField(f)
                    }}
                    className="text-muted-foreground hover:text-destructive"
                    title="Remove field"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </td>
              </tr>
            ))}
            {fields.length === 0 && (
              <tr>
                <td
                  colSpan={7}
                  className="px-3 py-6 text-center text-muted-foreground"
                >
                  No fields yet — add one below.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          size="sm"
          onClick={addField}
          className="gap-2"
        >
          <Plus className="size-4" />
          Add field
        </Button>
        <div className="flex items-center gap-3">
          {dirty && (
            <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
              <X className="size-3" />
              Unsaved changes
            </span>
          )}
          <Button
            onClick={save}
            disabled={!dirty || saving}
            size="sm"
            className="gap-2"
          >
            {saving ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Save className="size-4" />
            )}
            Save fields
          </Button>
        </div>
      </div>

      <Dialog
        open={confirmDelete !== null}
        onOpenChange={(o) => !o && setConfirmDelete(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove this field?</DialogTitle>
            <DialogDescription>
              {confirmDelete?.label}{" "}
              <span className="font-mono text-xs">({confirmDelete?.id})</span>{" "}
              will be dropped from the schema and its position in the coord
              map will be removed. Existing submissions keep their stored
              value but new ones won&apos;t collect it.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <DialogClose asChild>
              <Button
                variant="destructive"
                onClick={() => confirmDelete && removeField(confirmDelete)}
                className="gap-2"
              >
                <CheckCircle2 className="size-4" />
                Remove
              </Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
