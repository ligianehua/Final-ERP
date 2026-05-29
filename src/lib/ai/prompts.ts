/**
 * Versioned prompts. Keep these in one place so we can A/B-test and track
 * which version produced which result.
 */

export const DOCUMENT_EXTRACTION_PROMPT_V1 = `You extract structured fields from images of Philippine business documents (BIR forms, Mayor's Permits, SEC/DTI certificates, SSS/PhilHealth/Pag-IBIG records, bank certificates, etc.).

Return a JSON object with EXACTLY these keys. Use null whenever a field is not clearly visible in the image. NEVER invent or guess a value.

{
  "document_type": "BIR_2303" | "MAYORS_PERMIT" | "SEC_CERTIFICATE" | "DTI_CERTIFICATE" | "SSS_CERTIFICATE" | "PHILHEALTH_CERTIFICATE" | "PAGIBIG_CERTIFICATE" | "BANK_CERTIFICATE" | "OTHER",
  "document_number": string | null,
  "issued_date": "YYYY-MM-DD" | null,
  "expiry_date": "YYYY-MM-DD" | null,
  "issuing_authority": string | null,
  "subject_name": string | null,
  "tin": string | null,
  "sec_no": string | null,
  "dti_no": string | null,
  "sss_no": string | null,
  "philhealth_no": string | null,
  "pagibig_no": string | null,
  "address": string | null,
  "city": string | null,
  "phone": string | null,
  "email": string | null,
  "vat_status": "vat_registered" | "non_vat" | null
}

Rules:
- Dates MUST use ISO format YYYY-MM-DD. Convert any other format (e.g., "January 15, 2024") to this.
- TIN format is usually "XXX-XXX-XXX-XXX" — keep dashes.
- Phone numbers include country code if visible.
- subject_name is the person or entity the document is about (the taxpayer, permit holder, account owner).
- issuing_authority is the body that issued the document (e.g., "Bureau of Internal Revenue", "Quezon City Government").
- vat_status: "vat_registered" if marked VAT/VAT-registered; "non_vat" if marked Non-VAT or Percentage Tax; null if unclear.
- Output ONLY the JSON object. No prose, no markdown fences, no explanation.`

export const FORM_RECOGNITION_PROMPT_V1 = `You are looking at an image of a Philippine government form. Identify which of the supported forms it is.

Supported forms:
- BIR_2550M — Monthly VAT Declaration (BIR). Header shows "BIR Form 2550M" or "Monthly Value-Added Tax Declaration".
- MAYORS_PERMIT_RENEWAL — Mayor's Permit / Business Permit Renewal (LGU). Issued by a Philippine city or municipality.
- BIR_0605 — Payment Form (BIR). Header shows "BIR Form 0605" or "Payment Form".
- SEC_GIS — General Information Sheet (SEC). Header shows "General Information Sheet" or SEC logo.
- SSS_R3 — Contribution Collection List (SSS). Header shows "Form R-3" or "Contribution Collection List".

Return JSON exactly like this:
{
  "form_code": "BIR_2550M" | "MAYORS_PERMIT_RENEWAL" | "BIR_0605" | "SEC_GIS" | "SSS_R3" | "UNKNOWN",
  "form_name": string,
  "agency": "BIR" | "LGU" | "SEC" | "SSS" | "UNKNOWN",
  "confidence": number between 0 and 1,
  "reasoning": "brief explanation of which visual cues led to the identification"
}

Rules:
- If you are NOT confident enough (confidence below 0.7), set form_code to "UNKNOWN" and explain why in reasoning.
- The reasoning should be 1-2 sentences citing specific visible text or layout, not generic.
- Output ONLY the JSON object. No prose, no markdown fences.`
