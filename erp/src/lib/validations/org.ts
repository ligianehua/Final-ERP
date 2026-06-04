import { z } from "zod";

/**
 * URL-safe slug: 3–40 chars, lowercase a-z / digits / single dashes,
 * cannot start or end with a dash. Used as a stable identifier in
 * URLs once we ship org-namespaced routes.
 */
const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Three-letter ISO 4217 code matching the currencies table PK. */
const CURRENCY_REGEX = /^[A-Z]{3}$/;

export const orgCreateSchema = z.object({
  name: z.string().trim().min(1, "组织名不能为空").max(120),
  slug: z
    .string()
    .trim()
    .min(3)
    .max(40)
    .regex(SLUG_REGEX, "只能用小写字母、数字和连字符")
    .optional(),
  baseCurrency: z
    .string()
    .regex(CURRENCY_REGEX, "必须是三位大写币种代码，如 CNY / USD / PHP")
    .default("CNY"),
  timezone: z.string().trim().min(1).max(64).default("Asia/Shanghai"),
});

export type OrgCreateInput = z.infer<typeof orgCreateSchema>;

export const orgUpdateSchema = orgCreateSchema.partial();
export type OrgUpdateInput = z.infer<typeof orgUpdateSchema>;

/**
 * Best-effort slug from an org name. Server keeps a uniqueness guard,
 * so collisions just bounce back as a 409. Pure helper — safe in
 * client components too.
 */
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}]+/gu, "-") // any non-alphanumeric run → single dash
    .replace(/^-+|-+$/g, "") // trim leading/trailing dashes
    .slice(0, 40);
}
