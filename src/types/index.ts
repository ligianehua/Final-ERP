export type EntityType = "individual" | "company"

export type Company = {
  id: string
  user_id: string
  entity_type: EntityType
  name: string
  tin: string | null
  sec_no: string | null
  dti_no: string | null
  address: string | null
  city: string | null
  phone: string | null
  email: string | null
  vat_status: "vat_registered" | "non_vat" | null
  sss_no: string | null
  philhealth_no: string | null
  pagibig_no: string | null
  created_at: string
  updated_at: string
}

export type CompanyPerson = {
  id: string
  company_id: string
  full_name: string
  role: "owner" | "officer" | "employee" | "representative"
  tin: string | null
  sss_no: string | null
  philhealth_no: string | null
  pagibig_no: string | null
  email: string | null
  phone: string | null
  created_at: string
}

export type Document = {
  id: string
  user_id: string
  company_id: string
  document_type: DocumentType
  folder: DocumentFolder
  document_number: string | null
  issued_date: string | null
  expiry_date: string | null
  issuing_authority: string | null
  file_path: string
  file_name: string
  file_size: number | null
  mime_type: string | null
  extracted_data: Record<string, unknown> | null
  created_at: string
}

export type DocumentType =
  | "BIR_2303"
  | "MAYORS_PERMIT"
  | "SEC_CERTIFICATE"
  | "DTI_CERTIFICATE"
  | "SSS_CERTIFICATE"
  | "PHILHEALTH_CERTIFICATE"
  | "PAGIBIG_CERTIFICATE"
  | "BANK_CERTIFICATE"
  | "OTHER"

export type DocumentFolder =
  | "business_permits"
  | "tax"
  | "hr_social"
  | "financial"
  | "other"

export type FormTemplate = {
  id: string
  form_code: FormCode
  form_name: string
  agency: string
  frequency: "monthly" | "annual" | "per_payment"
  field_schema: FormFieldSchema[]
  pdf_template_url: string | null
}

export type FormCode =
  | "BIR_2550M"
  | "MAYORS_PERMIT_RENEWAL"
  | "BIR_0605"
  | "SEC_GIS"
  | "SSS_R3"

export type FormFieldSchema = {
  id: string
  label: string
  semantic_type: string
  data_source: string
  required: boolean
  pdf_coordinates?: { page: number; x: number; y: number; width: number; height: number }
}

export type FormSubmission = {
  id: string
  company_id: string
  form_template_id: string
  user_id: string
  status: "draft" | "completed" | "filed"
  field_values: Record<string, string | null>
  source_image_url: string | null
  output_pdf_url: string | null
  period: string | null
  filed_at: string | null
  created_at: string
}

export type Reminder = {
  id: string
  company_id: string
  document_id: string | null
  reminder_type: "document_expiry" | "form_deadline"
  title: string
  due_date: string
  snoozed_until: string | null
  is_dismissed: boolean
  created_at: string
}

export type AIFormRecognitionResult = {
  form_code: FormCode | "UNKNOWN"
  form_name: string
  agency: string
  confidence: number
  reasoning: string
}

export type AIFieldMappingResult = {
  fields: Array<{
    field_label: string
    semantic_type: string
    value: string | null
    source: string
    confidence: number
  }>
  missing_fields: Array<{
    field_label: string
    reason: string
    suggestion: string
  }>
}

export type AIDocumentExtraction = {
  document_type: DocumentType
  document_number: string | null
  issued_date: string | null
  expiry_date: string | null
  issuing_authority: string | null
  subject_entity: {
    name: string | null
    tin: string | null
  }
}
