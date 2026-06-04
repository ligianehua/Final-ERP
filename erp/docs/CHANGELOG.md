# Quill ERP · Changelog

> 每天结束写一条。新条目顶到最上。

---

## Week 1, Day 2 — 2026-06-04

### Done
- 装依赖：`drizzle-orm` `drizzle-kit` `postgres` `@supabase/supabase-js` `@supabase/ssr` `zod` `dotenv` `tsx` `server-only`
- `drizzle.config.ts`：postgresql 方言、schema 指向 `src/lib/db/schema/index.ts`、out 写到 `supabase/migrations/`（与 Supabase CLI 习惯对齐）；migration 走 `DATABASE_URL_DIRECT`（5432 直连）而非 pooler
- `src/lib/db/index.ts`：pgbouncer 兼容的 Drizzle client（`prepare: false`），走 `DATABASE_URL`（6543 pooler）
- Supabase 客户端辅助：
  - `src/lib/auth/supabase-browser.ts` — `createBrowserClient`
  - `src/lib/auth/supabase-server.ts` — `createServerClient`（Next.js 16 `cookies()` async）+ `createServiceClient`
- Schema 文件：
  - `_shared.ts` — `pk()` + `timestamps()` 帮手
  - `currencies.ts` — ISO 4217（PK = code）
  - `organizations.ts` — orgs、org_members（带 `org_role` enum：`org_admin / sales / purchasing / warehouse / viewer`），`(org_id, user_id)` 唯一
  - `parties.ts` — parties（org-scoped）、party_roles（PK 复合 = party_id + role，让一方既客户又供应商）、party_addresses、party_contacts
- Migration `20260604033448_init.sql`：
  - 7 张表 + 4 个 enum + 6 个 FK + 6 个索引
  - 末尾追加 `set_updated_at()` 触发器函数 + 7 张表全部挂 BEFORE UPDATE 触发器
  - 末尾追加 CNY / USD / PHP 三币种 seed（ON CONFLICT DO NOTHING，幂等）
- `package.json` scripts: `db:generate / db:migrate / db:push / db:studio / db:check`
- `pnpm build` + `pnpm lint` 全过；`pnpm db:check` 也认 schema

### 待你提供
- Supabase 新项目的 4 个变量：`NEXT_PUBLIC_SUPABASE_URL`、`NEXT_PUBLIC_SUPABASE_ANON_KEY`、`SUPABASE_SERVICE_ROLE_KEY`、`DATABASE_URL` + `DATABASE_URL_DIRECT`
- 拿到后直接 `pnpm db:migrate` 把 0001 推到云端

### Next
- Day 3: Email OTP 登录注册页 + proxy.ts（Next.js 16 的中间件新名）+ 会话刷新
- Day 4: 组织切换器 + `/dashboard` 主框架
- Day 5: RBAC middleware + `withOrg()` helper

---

## Week 1, Day 1 — 2026-06-04

### Done
- 项目脚手架：`erp/` 子目录里跑 `create-next-app` 出 Next.js 16 + TS + Tailwind v4 + ESLint + App Router + Turbopack
- 把 `app/` 挪进 `src/app/`，`@/*` 指向 `./src/*`，与 Permit 项目目录约定一致
- 写 `components.json`（Stone palette + RSC）
- `src/app/globals.css`：直接烤入 Stone OKLCH 调色板 + tw-animate-css
- 安装：`class-variance-authority` `clsx` `tailwind-merge` `lucide-react` `tw-animate-css`
- shadcn 组件：button / input / label / card
- `src/lib/utils.ts` (`cn()` 帮手)
- 目录骨架：`src/lib/{db,rbac,money,validations,auth}`、`src/types`、`src/server`、`supabase/migrations`、`scripts`
- `.env.local.example` 列全 Supabase + Drizzle + Anthropic + Resend + 汇率 + cron + admin allow-list
- `docs/CHANGELOG.md` + `docs/DECISIONS.md` 起头
- Landing 页（首屏 + 三个功能块 + footer）

### Next
- Day 2: 开 Supabase 项目（独立于 Permit）；接 Drizzle；写 0001 migration（organizations、org_members、parties、currencies seed）
- Day 3: Email OTP 登录注册流程
