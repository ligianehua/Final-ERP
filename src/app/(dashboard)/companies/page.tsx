import Link from "next/link"
import type { Metadata } from "next"
import { createClient } from "@/lib/db/server"
import { CreateCompanyDialog } from "@/components/forms/create-company-dialog"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Building2, User } from "lucide-react"
import type { Company } from "@/types"

export const metadata: Metadata = { title: "Companies" }

export default async function CompaniesPage() {
  const supabase = await createClient()
  const { data: companies } = await supabase
    .from("companies")
    .select("*")
    .order("created_at", { ascending: false })

  const list = (companies ?? []) as Company[]

  return (
    <div className="max-w-5xl mx-auto p-6 md:p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Companies</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Your archive of individuals and companies. Upload documents — Quill fills the rest.
          </p>
        </div>
        <CreateCompanyDialog />
      </div>

      {list.length === 0 ? (
        <div className="border border-dashed border-border rounded-lg p-12 text-center">
          <div className="size-12 rounded-full bg-secondary flex items-center justify-center mx-auto mb-4">
            <Building2 className="size-6 text-muted-foreground" />
          </div>
          <h3 className="font-medium text-foreground mb-1">Nothing here yet</h3>
          <p className="text-sm text-muted-foreground mb-6 max-w-sm mx-auto">
            Create your first archive — an individual or a company — to start uploading documents.
          </p>
          <CreateCompanyDialog />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {list.map((c) => (
            <Link key={c.id} href={`/companies/${c.id}`}>
              <Card className="hover:border-foreground/20 transition-colors h-full">
                <CardHeader>
                  <div className="flex items-start gap-3">
                    <div className="size-10 rounded-lg bg-secondary flex items-center justify-center shrink-0">
                      {c.entity_type === "individual" ? (
                        <User className="size-5 text-foreground" />
                      ) : (
                        <Building2 className="size-5 text-foreground" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <CardTitle className="text-base truncate">{c.name}</CardTitle>
                      {c.tin && (
                        <p className="text-xs text-muted-foreground mt-1">TIN: {c.tin}</p>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2 text-xs">
                    <span className="border border-border rounded px-2 py-0.5 text-muted-foreground">
                      {c.entity_type === "individual" ? "Individual" : "Company"}
                    </span>
                    {c.vat_status && (
                      <span className="border border-border rounded px-2 py-0.5 text-muted-foreground">
                        {c.vat_status === "vat_registered" ? "VAT Registered" : "Non-VAT"}
                      </span>
                    )}
                    {c.city && (
                      <span className="border border-border rounded px-2 py-0.5 text-muted-foreground">
                        {c.city}
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
