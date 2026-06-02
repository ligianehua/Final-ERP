"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import {
  CheckCircle2,
  Loader2,
  Plus,
  Save,
  Trash2,
  Wand2,
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
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false)
  const [bulkSemanticOpen, setBulkSemanticOpen] = useState(false)
  const [bulkSemanticType, setBulkSemanticType] = useState("text")
  const [dirty, setDirty] = useState(false)
  const [selected, setSelected] = useState<Set<number>>(new Set())

  const allSelected = useMemo(
    () => fields.length > 0 && selected.size === fields.length,
    [fields.length, selected.size],
  )
  const someSelected = selected.size > 0 && selected.size < fields.length

  function markDirty() {
    setDirty(true)
  }

  function toggleRow(i: number, on: boolean) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (on) next.add(i)
      else next.delete(i)
      return next
    })
  }

  function toggleAll(on: boolean) {
    setSelected(on ? new Set(fields.map((_, i) => i)) : new Set())
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
    setSelected(new Set())
    markDirty()
  }

  function bulkDelete() {
    if (selected.size === 0) return
    setFields((prev) => prev.filter((_, i) => !selected.has(i)))
    setSelected(new Set())
    setConfirmBulkDelete(false)
    markDirty()
  }

  function bulkApplySemanticType(type: string) {
    if (selected.size === 0) return
    setFields((prev) =>
      prev.map((f, i) =>
        selected.has(i) ? { ...f, semantic_type: type } : f,
      ),
    )
    setBulkSemanticOpen(false)
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
      {selected.size > 0 && (
        <div className="flex items-center justify-between gap-3 rounded-md border bg-muted/40 px-3 py-2 text-xs">
          <span className="font-medium">
            {selected.size} field{selected.size === 1 ? "" : "s"} selected
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setBulkSemanticOpen(true)}
              className="gap-1.5 h-7"
            >
              <Wand2 className="size-3.5" />
              Set semantic type
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setConfirmBulkDelete(true)}
              className="gap-1.5 h-7 text-destructive hover:text-destructive"
            >
              <Trash2 className="size-3.5" />
              Delete
            </Button>
            <button
              type="button"
              onClick={() => setSelected(new Set())}
              className="text-muted-foreground hover:text-foreground"
              title="Clear selection"
            >
              <X className="size-3.5" />
            </button>
          </div>
        </div>
      )}

      <div className="border rounded-md overflow-hidden">
        <table className="w-full text-xs">
          <thead className="bg-muted/40 text-muted-foreground">
            <tr>
              <th className="w-8 px-2 py-2">
                <input
                  type="checkbox"
                  checked={allSelected}
                  ref={(el) => {
                    if (el) el.indeterminate = someSelected
                  }}
                  onChange={(e) => toggleAll(e.target.checked)}
                  aria-label="Select all"
                  className="size-3.5"
                />
              </th>
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
              <tr
                key={i}
                className={cn(
                  "border-t",
                  selected.has(i) && "bg-muted/30",
                )}
              >
                <td className="px-2 py-2 align-top text-center">
                  <input
                    type="checkbox"
                    checked={selected.has(i)}
                    onChange={(e) => toggleRow(i, e.target.checked)}
                    aria-label={`Select ${f.label || f.id}`}
                    className="size-3.5 mt-1"
                  />
                </td>
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
                  colSpan={8}
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
      <Dialog
        open={confirmBulkDelete}
        onOpenChange={setConfirmBulkDelete}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Remove {selected.size} field{selected.size === 1 ? "" : "s"}?
            </DialogTitle>
            <DialogDescription>
              All selected fields will be dropped from the schema and
              their coord-map entries removed. Existing submissions keep
              their stored values but new ones won&apos;t collect them.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button
              variant="destructive"
              onClick={bulkDelete}
              className="gap-2"
            >
              <CheckCircle2 className="size-4" />
              Remove {selected.size}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={bulkSemanticOpen}
        onOpenChange={setBulkSemanticOpen}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Set semantic type on {selected.size}</DialogTitle>
            <DialogDescription>
              Apply one semantic type to all selected fields. Useful for
              re-typing a batch of fields the AI got wrong.
            </DialogDescription>
          </DialogHeader>
          <select
            value={bulkSemanticType}
            onChange={(e) => setBulkSemanticType(e.target.value)}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            {SEMANTIC_TYPES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <DialogFooter className="gap-2">
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button
              onClick={() => bulkApplySemanticType(bulkSemanticType)}
              className="gap-2"
            >
              <CheckCircle2 className="size-4" />
              Apply
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
