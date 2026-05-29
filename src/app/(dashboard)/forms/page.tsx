import { createClient } from "@/lib/db/server"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { FormRecognizer } from "@/components/forms/form-recognizer"
import { FileCheck } from "lucide-react"

type FormTemplate = {
  id: string
  form_code: string
  form_name: string
  agency: string
  frequency: string | null
}

const FREQUENCY_LABELS: Record<string, string> = {
  monthly: "Monthly",
  annual: "Annual",
  quarterly: "Quarterly",
  per_payment: "Per payment",
}

export default async function FormsPage() {
  const supabase = await createClient()
  const { data } = await supabase
    .from("form_templates")
    .select("id, form_code, form_name, agency, frequency")
    .eq("is_active", true)
    .order("form_code")

  const templates = (data ?? []) as FormTemplate[]

  return (
    <div className="max-w-5xl mx-auto p-6 md:p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">Forms</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Upload a photo of a blank government form — Quill identifies which form it is.
        </p>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <FormRecognizer />
        </div>

        <Card className="h-fit">
          <CardHeader>
            <CardTitle className="text-base">Supported forms</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {templates.map((t) => (
                <li key={t.id} className="flex items-start gap-3 text-sm">
                  <div className="size-8 rounded-md bg-secondary flex items-center justify-center shrink-0 mt-0.5">
                    <FileCheck className="size-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium truncate">{t.form_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {t.agency} · {t.form_code}
                      {t.frequency && ` · ${FREQUENCY_LABELS[t.frequency] ?? t.frequency}`}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
