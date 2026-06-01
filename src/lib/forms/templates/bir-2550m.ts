import type { TemplateConfig } from "../template-types"

/**
 * Coordinate map for the official BIR 2550M PDF
 * (`public/form-templates/BIR_2550M.pdf`, US Legal 612 × 1008 pt, 5 pages).
 *
 * No AcroForm fields in this PDF — we synthesise text fields at the
 * positions below. Source positions come from `pdftotext -bbox-layout`
 * on the template, then offset by hand to line up with the input boxes
 * drawn under the official labels.
 *
 * Widths matter twice: pdf-lib uses them to size the AcroForm box drawn
 * on the PDF, and the in-browser editor (Phase 2) will use the same
 * values to size HTML input overlays.
 *
 * Schema fields without a natural spot on the official form are
 * intentionally omitted:
 *   - `trade_name`  — official form only has "Taxpayer's Name"
 *   - `city`        — folded into the Registered Address row
 *   - `email`       — not collected on this form
 *   - `vat_status`  — implicit (the whole form IS the VAT return)
 */

const PAGE_H = 1008

/** Convert top-down y (from `pdftotext -bbox-layout`) → pdf-lib baseline. */
const fromTop = (yTop: number) => PAGE_H - yTop

export const BIR_2550M_TEMPLATE: TemplateConfig = {
  pdf_path: "public/form-templates/BIR_2550M.pdf",
  dimensions: { width: 612, height: 1008, pageCount: 5 },
  transformValues: (values) => {
    const month = values.period_month?.padStart(2, "0")
    const year = values.period_year
    return {
      ...values,
      period_display: month && year ? `${month}/${year}` : null,
    }
  },
  mapping: {
    strategy: "coordinates",
    fields: {
      // Heights default to `size + 2` in the renderer; we omit them here
      // so all fields stay vertically tight.

      // Item 1: For the Month of (MM/YYYY)
      period_display: { page: 1, x: 175, y: fromTop(82), width: 100, size: 10 },

      // Item 4: TIN  (label top at y≈100; input row below)
      tin:              { page: 1, x: 45,  y: fromTop(120), width: 170, size: 11 },
      // Item 5: RDO Code
      rdo_code:         { page: 1, x: 235, y: fromTop(120), width: 70,  size: 11 },
      // Item 6: Line of Business
      line_of_business: { page: 1, x: 335, y: fromTop(120), width: 240, size: 9 },

      // Item 7: Taxpayer's Name
      registered_name: { page: 1, x: 35,  y: fromTop(143), width: 420, size: 11 },
      // Item 8: Telephone Number
      telephone:       { page: 1, x: 465, y: fromTop(143), width: 115, size: 10 },

      // Item 9: Registered Address
      registered_address: { page: 1, x: 35, y: fromTop(168), width: 420, size: 10 },

      // Item 12A/B: Vatable Sales | Output Tax (column right edges)
      gross_sales: { page: 1, x: 430, y: fromTop(222), width: 140, size: 10, align: "right" },
      output_tax:  { page: 1, x: 585, y: fromTop(222), width: 130, size: 10, align: "right" },

      // Item 19: Total Available Input Tax (right column)
      input_tax: { page: 1, x: 585, y: fromTop(453), width: 130, size: 10, align: "right" },

      // Item 26: Tax Still Payable / Net VAT Payable
      vat_payable: { page: 1, x: 585, y: fromTop(685), width: 130, size: 10, align: "right" },

      // Signatory block (left column — Taxpayer / Authorized Rep)
      signatory_name:     { page: 1, x: 70,  y: fromTop(730), width: 230, size: 10 },
      signatory_position: { page: 1, x: 70,  y: fromTop(778), width: 150, size: 9 },
      signatory_tin:      { page: 1, x: 220, y: fromTop(778), width: 120, size: 9 },
    },
  },
}
