import Link from "next/link"
import { createClient } from "@/lib/db/server"
import { CreateCompanyDialog } from "@/components/forms/create-company-dialog"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Building2 } from "lucide-react"
import type { Company } from "@/types"

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
            Your company archive. Each company stores info reused across every form.
          </p>
        </div>
        <CreateCompanyDialog />
      </div>

      {list.length === 0 ? (
        <div className="border border-dashed border-border rounded-lg p-12 text-center">
          <div className="size-12 rounded-full bg-secondary flex items-center justify-center mx-auto mb-4">
            <Building2 className="size-6 text-muted-foreground" />
          </div>
          <h3 className="font-medium text-foreground mb-1">No companies yet</h3>
          <p className="text-sm text-muted-foreground mb-6 max-w-sm mx-auto">
            Create your first company to start building your archive and filling forms.
          </p>
          <CreateCompanyDialog />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {list.map((company) => (
            <Link key={company.id} href={`/companies/${company.id}`}>
              <Card className="hover:border-foreground/20 transition-colors h-full">
                <CardHeader>
                  <div className="flex items-start gap-3">
                    <div className="size-10 rounded-lg bg-secondary flex items-center justify-center shrink-0">
                      <Building2 className="size-5 text-foreground" />
                    </div>
                    <div className="min-w-0">
                      <CardTitle className="text-base truncate">{company.name}</CardTitle>
                      {company.tin && (
                        <p className="text-xs text-muted-foreground mt-1">TIN: {company.tin}</p>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2 text-xs">
                    {company.vat_status && (
                      <span className="border border-border rounded px-2 py-0.5 text-muted-foreground">
                        {company.vat_status === "vat_registered" ? "VAT Registered" : "Non-VAT"}
                      </span>
                    )}
                    {company.city && (
                      <span className="border border-border rounded px-2 py-0.5 text-muted-foreground">
                        {company.city}
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
