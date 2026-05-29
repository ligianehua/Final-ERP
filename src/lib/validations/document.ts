import { z } from "zod"

export const documentTypeSchema = z.enum([
  "BIR_2303",
  "MAYORS_PERMIT",
  "SEC_CERTIFICATE",
  "DTI_CERTIFICATE",
  "SSS_CERTIFICATE",
  "PHILHEALTH_CERTIFICATE",
  "PAGIBIG_CERTIFICATE",
  "BANK_CERTIFICATE",
  "OTHER",
])

export const documentFolderSchema = z.enum([
  "business_permits",
  "tax",
  "hr_social",
  "financial",
  "other",
])

// Client uploads the file to Storage first; this API call records metadata.
export const documentCreateSchema = z.object({
  company_id: z.string().uuid(),
  document_type: documentTypeSchema,
  folder: documentFolderSchema,
  file_path: z.string().min(1),
  file_name: z.string().min(1).max(255),
  file_size: z.number().int().nonnegative().nullable().optional(),
  mime_type: z.string().max(100).nullable().optional(),
})

export type DocumentCreate = z.infer<typeof documentCreateSchema>
export type DocumentTypeValue = z.infer<typeof documentTypeSchema>
export type DocumentFolderValue = z.infer<typeof documentFolderSchema>

// Friendly labels for UI
export const DOCUMENT_TYPE_LABELS: Record<
  z.infer<typeof documentTypeSchema>,
  string
> = {
  BIR_2303: "BIR Certificate of Registration (2303)",
  MAYORS_PERMIT: "Mayor's Permit",
  SEC_CERTIFICATE: "SEC Certificate",
  DTI_CERTIFICATE: "DTI Certificate",
  SSS_CERTIFICATE: "SSS Certificate",
  PHILHEALTH_CERTIFICATE: "PhilHealth Certificate",
  PAGIBIG_CERTIFICATE: "Pag-IBIG Certificate",
  BANK_CERTIFICATE: "Bank Certificate",
  OTHER: "Other",
}

export const DOCUMENT_FOLDER_LABELS: Record<
  z.infer<typeof documentFolderSchema>,
  string
> = {
  business_permits: "Business Permits",
  tax: "Tax",
  hr_social: "HR & Social",
  financial: "Financial",
  other: "Other",
}

// Default folder for each document type — used to pre-select in the UI.
export const DOCUMENT_TYPE_DEFAULT_FOLDER: Record<
  z.infer<typeof documentTypeSchema>,
  z.infer<typeof documentFolderSchema>
> = {
  BIR_2303: "tax",
  MAYORS_PERMIT: "business_permits",
  SEC_CERTIFICATE: "business_permits",
  DTI_CERTIFICATE: "business_permits",
  SSS_CERTIFICATE: "hr_social",
  PHILHEALTH_CERTIFICATE: "hr_social",
  PAGIBIG_CERTIFICATE: "hr_social",
  BANK_CERTIFICATE: "financial",
  OTHER: "other",
}
