import type { TemplateConfig } from "../render-on-template"

/**
 * Coordinate map for the official BIR 2550M PDF
 * (`public/form-templates/BIR_2550M.pdf`, US Legal 612 × 1008 pt, 5 pages).
 *
 * No AcroForm fields in this PDF — text is drawn directly on the page at
 * the positions below. Source positions come from
 * `pdftotext -bbox-layout` on the template, then offset by hand to line up
 * with the input boxes drawn under the official labels.
 *
 * Schema fields without a natural spot on the official form are
 * intentionally omitted:
 *   - `trade_name`  — official form only has "Taxpayer's Name"
 *   - `city`        — folded into the Registered Address row
 *   - `email`       — not collected on this form
 *   - `vat_status`  — implicit (the whole form IS the VAT return)
 *
 * The signatory block (page 1, items 27/28) only has a single column
 * for the taxpayer; we fill the left column.
 */

const PAGE_H = 1008

/** Convert top-down y (from `pdftotext -bbox-layout`) → pdf-lib baseline. */
const fromTop = (yTop: number) => PAGE_H - yTop

export const BIR_2550M_TEMPLATE: TemplateConfig = {
  pdf_path: "public/form-templates/BIR_2550M.pdf",
  transformValues: (values) => {
    // Item 1 "For the Month of (MM/YYYY)" is a single input slot.
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
      // Item 1: For the Month of (MM/YYYY)
      period_display: { page: 1, x: 175, y: fromTop(82), size: 10 },

      // Item 4: TIN  (label at 30,100 → input below)
      tin: { page: 1, x: 60, y: fromTop(120), size: 11 },
      // Item 5: RDO Code  (label at 230,100)
      rdo_code: { page: 1, x: 240, y: fromTop(120), size: 11 },
      // Item 6: Line of Business  (label at 330,100)
      line_of_business: {
        page: 1,
        x: 340,
        y: fromTop(120),
        size: 9,
        maxWidth: 200,
      },

      // Item 7: Taxpayer's Name  (label at 30,123)
      registered_name: {
        page: 1,
        x: 40,
        y: fromTop(143),
        size: 11,
        maxWidth: 410,
      },
      // Item 8: Telephone Number  (label at 462,120)
      telephone: {
        page: 1,
        x: 470,
        y: fromTop(143),
        size: 10,
        maxWidth: 110,
      },

      // Item 9: Registered Address  (label at 30,146)
      registered_address: {
        page: 1,
        x: 40,
        y: fromTop(168),
        size: 10,
        maxWidth: 410,
      },

      // Item 12A/B: Vatable Sales / Output Tax  (row label tops at y=214)
      gross_sales: {
        page: 1,
        x: 425,
        y: fromTop(222),
        size: 10,
        align: "right",
      },
      output_tax: {
        page: 1,
        x: 570,
        y: fromTop(222),
        size: 10,
        align: "right",
      },

      // Item 19: Total Available Input Tax  (label at 30,445 — right column)
      input_tax: {
        page: 1,
        x: 570,
        y: fromTop(453),
        size: 10,
        align: "right",
      },

      // Item 26: Tax Still Payable / Net VAT Payable  (label at 30,676)
      vat_payable: {
        page: 1,
        x: 570,
        y: fromTop(685),
        size: 10,
        align: "right",
      },

      // Signatory block — left column (Taxpayer / Authorized Representative)
      // Printed name above the "Signature Over Printed Name" caption (y≈732).
      signatory_name: {
        page: 1,
        x: 80,
        y: fromTop(730),
        size: 10,
        maxWidth: 220,
      },
      // Below "Title/Position of Signatory" caption (y≈765).
      signatory_position: {
        page: 1,
        x: 80,
        y: fromTop(778),
        size: 9,
        maxWidth: 140,
      },
      // Below "TIN of Signatory" caption — center column of the left half.
      signatory_tin: {
        page: 1,
        x: 220,
        y: fromTop(778),
        size: 9,
      },
    },
  },
}
