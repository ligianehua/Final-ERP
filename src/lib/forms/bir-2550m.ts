import type { FormSchema } from "./types"

/**
 * Field schema for BIR Form 2550M — Monthly VAT Declaration.
 * MVP scope: identity / header fields only. The tax computation section
 * (sales, output tax, input tax, etc.) is period-specific and will be
 * collected via a separate calculation step later.
 */
export const BIR_2550M_SCHEMA: FormSchema = {
  form_code: "BIR_2550M",
  form_name: "Monthly VAT Declaration",
  agency: "BIR",
  fields: [
    // Period (user picks for this filing)
    {
      id: "period_month",
      label: "For the Month",
      semantic_type: "period_month",
      data_source: null,
      required: true,
      period_specific: true,
      hint: "01-12",
    },
    {
      id: "period_year",
      label: "For the Year",
      semantic_type: "period_year",
      data_source: null,
      required: true,
      period_specific: true,
      hint: "YYYY",
    },

    // Taxpayer identity (pulled from company archive)
    {
      id: "tin",
      label: "Taxpayer Identification Number (TIN)",
      semantic_type: "company_tin",
      data_source: "company.tin",
      required: true,
      period_specific: false,
    },
    {
      id: "rdo_code",
      label: "RDO Code",
      semantic_type: "text",
      data_source: null,
      required: false,
      period_specific: false,
      hint: "3-digit code from your BIR 2303",
    },
    {
      id: "registered_name",
      label: "Registered Name",
      semantic_type: "company_name",
      data_source: "company.name",
      required: true,
      period_specific: false,
    },
    {
      id: "trade_name",
      label: "Trade / Business Name",
      semantic_type: "text",
      data_source: null,
      required: false,
      period_specific: false,
    },
    {
      id: "line_of_business",
      label: "Line of Business",
      semantic_type: "text",
      data_source: null,
      required: false,
      period_specific: false,
    },
    {
      id: "registered_address",
      label: "Registered Address",
      semantic_type: "company_address",
      data_source: "company.address",
      required: true,
      period_specific: false,
    },
    {
      id: "city",
      label: "City",
      semantic_type: "company_city",
      data_source: "company.city",
      required: false,
      period_specific: false,
    },
    {
      id: "telephone",
      label: "Telephone Number",
      semantic_type: "company_phone",
      data_source: "company.phone",
      required: false,
      period_specific: false,
    },
    {
      id: "email",
      label: "Email Address",
      semantic_type: "company_email",
      data_source: "company.email",
      required: false,
      period_specific: false,
    },
    {
      id: "vat_status",
      label: "Tax Type",
      semantic_type: "company_vat_status",
      data_source: "company.vat_status",
      required: true,
      period_specific: false,
      hint: "Should be VAT Registered",
    },

    // Authorized signatory (pulled from people roster)
    {
      id: "signatory_name",
      label: "Signatory — Name",
      semantic_type: "signatory_name",
      data_source: "person.full_name",
      required: true,
      period_specific: false,
      hint: "President / authorized officer",
    },
    {
      id: "signatory_position",
      label: "Signatory — Position",
      semantic_type: "signatory_position",
      data_source: "person.position_title",
      required: false,
      period_specific: false,
    },
    {
      id: "signatory_tin",
      label: "Signatory — TIN",
      semantic_type: "signatory_tin",
      data_source: "person.tin",
      required: false,
      period_specific: false,
    },

    // Period-specific tax computations (user enters each filing)
    {
      id: "gross_sales",
      label: "Gross Sales / Receipts (₱)",
      semantic_type: "amount",
      data_source: null,
      required: true,
      period_specific: true,
    },
    {
      id: "output_tax",
      label: "Output Tax Due (₱)",
      semantic_type: "amount",
      data_source: null,
      required: false,
      period_specific: true,
      hint: "Computed: gross_sales × 12%",
    },
    {
      id: "input_tax",
      label: "Input Tax Credits (₱)",
      semantic_type: "amount",
      data_source: null,
      required: false,
      period_specific: true,
    },
    {
      id: "vat_payable",
      label: "VAT Payable (₱)",
      semantic_type: "amount",
      data_source: null,
      required: false,
      period_specific: true,
      hint: "Computed: output_tax − input_tax",
    },
  ],
}
