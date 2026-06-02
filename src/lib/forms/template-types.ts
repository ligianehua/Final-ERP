/**
 * Shared types for form templates — pure data, zero runtime imports so
 * the templates registry can be `import`-ed safely from both server
 * (rendering) and client (WYSIWYG editor) code.
 *
 * pdf-lib uses a bottom-left origin: y grows upward. Coordinates are in
 * PDF points (1 pt = 1/72 inch). For US Legal pages, the page is
 * 612 wide × 1008 tall.
 */

export type CoordSpec = {
  /** 1-indexed page number. */
  page: number
  /** Baseline x (left edge for left-align, right edge for right-align). */
  x: number
  /** Text baseline y. */
  y: number
  /** Width of the input box. Defaults to `maxWidth` ?? 100. */
  width?: number
  /** Height of the input box. Defaults to `size + 2`. */
  height?: number
  /** Font size in points. Defaults to 10. */
  size?: number
  /** Horizontal anchor for `x`. Defaults to "left". */
  align?: "left" | "right" | "center"
  /**
   * Legacy cap for visible text width. If `width` is absent, this is
   * used as the box width.
   */
  maxWidth?: number
}

export type AcroFormMapping = {
  strategy: "acroform"
  /** schema field id → AcroForm widget name */
  fields: Record<string, string>
}

export type CoordinateMapping = {
  strategy: "coordinates"
  /** schema field id → where on the page to draw the value */
  fields: Record<string, CoordSpec>
}

export type TemplateDimensions = {
  /** Page width in PDF points. */
  width: number
  /** Page height in PDF points. */
  height: number
  /** Total number of pages in the template PDF. */
  pageCount: number
}

export type TemplateConfig = {
  /**
   * Either:
   *   - A filesystem path relative to the project root, for code-shipped
   *     templates baked under `public/form-templates/`, OR
   *   - A Storage bucket key, when `storage_bucket` is also set (used
   *     for templates uploaded by admins via /admin/templates/new).
   */
  pdf_path: string
  /** When set, `pdf_path` resolves inside this Supabase Storage bucket. */
  storage_bucket?: string
  /** Page dimensions and count — required for the WYSIWYG editor. */
  dimensions: TemplateDimensions
  mapping: AcroFormMapping | CoordinateMapping
  /**
   * Optional value transformer applied before rendering. Use it to derive
   * composite fields (e.g. `period_display` from `period_month` +
   * `period_year`).
   */
  transformValues?: (
    values: Record<string, string | null>,
  ) => Record<string, string | null>
}

/**
 * Per-submission drag adjustments to a field's position, in PDF points,
 * relative to the template's default coordinate. Empty {} = use template
 * positions as-is.
 */
export type FieldOverride = {
  /** Positive moves the field RIGHT in PDF coords. */
  dx: number
  /** Positive moves the field UP in PDF coords. */
  dy: number
}

export type FieldOverrides = Record<string, FieldOverride>
