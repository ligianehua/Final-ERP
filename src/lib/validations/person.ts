import { z } from "zod"

export const personRoleSchema = z.enum(["owner", "officer", "employee", "representative"])

export const personCreateSchema = z.object({
  full_name: z.string().min(1, "Name is required").max(200),
  role: personRoleSchema,
  position_title: z.string().max(100).nullable().optional(),
  tin: z.string().max(50).nullable().optional(),
  sss_no: z.string().max(50).nullable().optional(),
  philhealth_no: z.string().max(50).nullable().optional(),
  pagibig_no: z.string().max(50).nullable().optional(),
  email: z.string().email().max(200).nullable().optional().or(z.literal("")),
  phone: z.string().max(50).nullable().optional(),
})

export type PersonCreate = z.infer<typeof personCreateSchema>
export type PersonRoleValue = z.infer<typeof personRoleSchema>

export const personUpdateSchema = personCreateSchema.partial()
export type PersonUpdate = z.infer<typeof personUpdateSchema>

export const PERSON_ROLE_LABELS: Record<PersonRoleValue, string> = {
  owner: "Owner",
  officer: "Officer",
  employee: "Employee",
  representative: "Representative",
}
