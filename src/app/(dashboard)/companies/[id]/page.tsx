import Link from "next/link"
import { notFound } from "next/navigation"
import { createClient } from "@/lib/db/server"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { DeleteCompanyButton } from "@/components/forms/delete-company-button"
import { UploadDocumentDialog } from "@/components/forms/upload-document-dialog"
import { DocumentList } from "@/components/documents/document-list"
import { ArrowLeft, Building2, User } from "lucide-react"
import type { Company, Document } from "@/types"

export default async function CompanyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const [{ data: company }, { data: documents }] = await Promise.all([
    supabase.from("companies").select("*").eq("id", id).single(),
    supabase
      .from("documents")
      .select("*")
      .eq("company_id", id)
      .order("created_at", { ascending: false }),
  ])

  if (!company) {
    notFound()
  }

  const c = company as Company
  const docs = (documents ?? []) as Document[]
  const isIndividual = c.entity_type === "individual"

  const commonFields: Array<{ label: string; value: string | null }> = [
    { label: "TIN", value: c.tin },
    { label: "DTI No.", value: c.dti_no },
    { label: "Address", value: c.address },
    { label: "City", value: c.city },
    { label: "Phone", value: c.phone },
    { label: "Email", value: c.email },
    {
      label: "VAT Status",
      value:
        c.vat_status === "vat_registered"
          ? "VAT Registered"
          : c.vat_status === "non_vat"
            ? "Non-VAT"
            : null,
    },
  ]

  const companyOnly: Array<{ label: string; value: string | null }> = [
    { label: "SEC No.", value: c.sec_no },
  ]

  const individualOnly: Array<{ label: string; value: string | null }> = [
    { label: "SSS No.", value: c.sss_no },
    { label: "PhilHealth No.", value: c.philhealth_no },
    { label: "Pag-IBIG No.", value: c.pagibig_no },
  ]

  const fields = isIndividual
    ? [...commonFields, ...individualOnly]
    : [...companyOnly, ...commonFields]

  return (
    <div className="max-w-3xl mx-auto p-6 md:p-8">
      <Link
        href="/companies"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6"
      >
        <ArrowLeft className="size-4" />
        Back
      </Link>

      <div className="flex items-start justify-between mb-8">
        <div className="flex items-start gap-3">
          <div className="size-12 rounded-lg bg-secondary flex items-center justify-center shrink-0">
            {isIndividual ? <User className="size-6" /> : <Building2 className="size-6" />}
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{c.name}</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {isIndividual ? "Individual · Sole proprietor" : "Company"}
            </p>
          </div>
        </div>
        <DeleteCompanyButton id={c.id} name={c.name} />
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Profile</CardTitle>
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

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="text-base">Documents</CardTitle>
              <p className="text-xs text-muted-foreground mt-1">
                {docs.length} {docs.length === 1 ? "file" : "files"}
              </p>
            </div>
            <UploadDocumentDialog companyId={c.id} />
          </CardHeader>
          <CardContent>
            <DocumentList documents={docs} />
          </CardContent>
        </Card>
      </div>

      <p className="text-xs text-muted-foreground mt-6 text-center">
        Profile fields will auto-fill from uploaded documents (Week 3).
      </p>
    </div>
  )
}
