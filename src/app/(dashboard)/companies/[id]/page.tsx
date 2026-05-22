import Link from "next/link"
import { notFound } from "next/navigation"
import { createClient } from "@/lib/db/server"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { DeleteCompanyButton } from "@/components/forms/delete-company-button"
import { ArrowLeft } from "lucide-react"
import type { Company } from "@/types"

export default async function CompanyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const { data: company } = await supabase
    .from("companies")
    .select("*")
    .eq("id", id)
    .single()

  if (!company) {
    notFound()
  }

  const c = company as Company

  const fields: Array<{ label: string; value: string | null }> = [
    { label: "TIN", value: c.tin },
    { label: "SEC No.", value: c.sec_no },
    { label: "DTI No.", value: c.dti_no },
    { label: "VAT Status", value: c.vat_status === "vat_registered" ? "VAT Registered" : c.vat_status === "non_vat" ? "Non-VAT" : null },
    { label: "Address", value: c.address },
    { label: "City", value: c.city },
    { label: "Phone", value: c.phone },
    { label: "Email", value: c.email },
  ]

  return (
    <div className="max-w-3xl mx-auto p-6 md:p-8">
      <Link
        href="/companies"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6"
      >
        <ArrowLeft className="size-4" />
        Back to companies
      </Link>

      <div className="flex items-start justify-between mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">{c.name}</h1>
        <div className="flex gap-2">
          <DeleteCompanyButton id={c.id} name={c.name} />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Company Info</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="divide-y divide-border">
            {fields.map((f) => (
              <div key={f.label} className="flex justify-between py-3 text-sm">
                <dt className="text-muted-foreground">{f.label}</dt>
                <dd className="text-foreground font-medium">{f.value || "—"}</dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground mt-6">
        People, documents, and employees coming in Week 2.
      </p>
    </div>
  )
}
