import { z } from "zod"

export const companyInputSchema = z.object({
  name: z.string().min(1, "Company name is required").max(200),
  tin: z.string().max(50).optional().nullable(),
  sec_no: z.string().max(50).optional().nullable(),
  dti_no: z.string().max(50).optional().nullable(),
  address: z.string().max(500).optional().nullable(),
  city: z.string().max(100).optional().nullable(),
  phone: z.string().max(50).optional().nullable(),
  email: z.string().email("Invalid email").max(200).optional().nullable().or(z.literal("")),
  vat_status: z.enum(["vat_registered", "non_vat"]).optional().nullable(),
})

export type CompanyInput = z.infer<typeof companyInputSchema>

// PATCH allows partial updates
export const companyUpdateSchema = companyInputSchema.partial()
export type CompanyUpdate = z.infer<typeof companyUpdateSchema>
