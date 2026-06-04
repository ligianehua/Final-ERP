import { z } from "zod"

export const entityTypeSchema = z.enum(["individual", "company"])

// Minimal creation: type + name only. Everything else is optional and
// will be auto-filled by document extraction later (or edited manually).
export const companyCreateSchema = z.object({
  entity_type: entityTypeSchema,
  name: z.string().min(1, "Name is required").max(200),
})

export type CompanyCreate = z.infer<typeof companyCreateSchema>

// PATCH accepts any subset of the full profile fields.
export const companyUpdateSchema = z.object({
  entity_type: entityTypeSchema.optional(),
  name: z.string().min(1).max(200).optional(),
  tin: z.string().max(50).nullable().optional(),
  sec_no: z.string().max(50).nullable().optional(),
  dti_no: z.string().max(50).nullable().optional(),
  address: z.string().max(500).nullable().optional(),
  city: z.string().max(100).nullable().optional(),
  phone: z.string().max(50).nullable().optional(),
  email: z.string().email().max(200).nullable().optional().or(z.literal("")),
  vat_status: z.enum(["vat_registered", "non_vat"]).nullable().optional(),
  sss_no: z.string().max(50).nullable().optional(),
  philhealth_no: z.string().max(50).nullable().optional(),
  pagibig_no: z.string().max(50).nullable().optional(),
})

export type CompanyUpdate = z.infer<typeof companyUpdateSchema>
