# Quill ERP · Changelog

> 每天结束写一条。新条目顶到最上。

---

## Week 1, Day 4 — 2026-06-04

### Done — 组织创建 & 首次登录引导
- `src/lib/validations/org.ts`：`orgCreateSchema` / `orgUpdateSchema` + `slugify(name)` 帮手；slug 走 `^[a-z0-9]+(?:-[a-z0-9]+)*$`，本位币校验三位大写
- `src/lib/auth/session.ts`：`getCurrentUser()`（`React.cache` 包过，每请求一次）+ `requireUser()` + `UnauthorizedError`
- `src/lib/orgs/current.ts`：
  - `getCurrentOrg()` — 读 `quill_active_org` cookie，命中且仍是成员就用它；否则按 `org_members.created_at` 最早那条；都没有返回 `null`（触发 bootstrap UX）
  - `listMyOrgs()` — 组织切换器后续要用
  - `isMember(userId, orgId)` — 防 cookie 篡改的守门函数
  - 每个都 `React.cache` 过

### Done — API routes
- `GET /api/orgs` — 返回当前用户所有组织 + 角色
- `POST /api/orgs` — Zod 校验 → 单事务里建 `organizations` 行 + 自动给当前用户挂 `org_admin` membership → 成功后顺手把 `quill_active_org` cookie 设上。捕获 Postgres `23505`（unique violation）→ 409 `slug_taken`
- `POST /api/orgs/active` — 切换活跃组织前先 `isMember()` 校验；不是成员直接 403

### Done — UI
- shadcn `dialog` 装好
- `<CreateOrgDialog>`（client）：
  - `defaultOpen` 让 bootstrap 卡片直接挂着它
  - 名称 + 本位币（CNY/USD/PHP 三选一），slug 由后端从 name 自动生成
  - 成功后 `router.refresh()` —— RSC 重抓数据，dashboard 立刻换面
- `/dashboard` 改成两态：
  - 没组织 → BootstrapPanel + 内嵌打开的 dialog
  - 有组织 → ActiveOrgPanel（组织名 / slug / 本位币 / 你的角色徽章）+ 下一步规划卡

### 自测路线
```
登录后落 /dashboard → "创建你的第一个组织" 卡片 + dialog 直接弹
→ 输组织名（比如「上海菱锦贸易」）→ 选 CNY → 创建
→ Dialog 关闭，dashboard 切到 ActiveOrgPanel
→ 上面写组织名、slug、本位币、"你是 · 管理员"
```

Supabase Table Editor 验证：
- `organizations` 多一行（slug 是自动 slugified 的）
- `org_members` 多一行（role = `org_admin`，user_id = 你的 auth user）

### Next
- Day 5: dashboard 主框架（Topbar + Sidebar）+ 组织切换器 dropdown + `requireRole()` helper
- Day 6: Vercel 部署 + 子域绑定
- Day 7: 内部自测，**Week 1 Demo**

---

## Week 1, Day 3 — 2026-06-04

### Done
- `src/proxy.ts`（Next.js 16 把 `middleware` 改名 `proxy`，已经按官方 doc 写法）：
  - 每次请求刷新 Supabase session cookie
  - 粗粒度 auth gate：未登录访问 `/dashboard /items /warehouses /parties /sales /purchases /reports /settings` 都跳 `/login?next=<原路径>`
  - 已登录访问 `/login` `/signup` 自动跳 `/dashboard`
  - matcher 排除 `_next/static`、`_next/image`、favicon、og-image、robots/sitemap
- 认证页（`(auth)` 路由组）：
  - `/login` — 两步式 Email OTP（输邮箱 → 收验证码 → 提交），保留 `?next` 跳回
  - `/signup` — 同上但 `shouldCreateUser: true`
  - 两个页都把 `useSearchParams` / 主体表单包进 `<Suspense>`，避免 prerender bailout
- API routes：
  - `GET /api/auth/callback` — OAuth / magic-link code exchange（OTP 流程没用，留给未来 Google 登录）
  - `POST /api/auth/sign-out` — 清 cookie 跳回 `/`
- `/dashboard` 占位页（Server Component）：
  - 服务端读 user，没 session redirect `/login`
  - 显示 `欢迎回来 · {email}`
  - 退出登录按钮（form POST 到 sign-out 路由）
- 顺手修了父级 Permit 项目：
  - `tsconfig.json` exclude 加 `erp`，否则 Permit tsc 会扫到 erp/ 然后 import alias 解错
  - `eslint.config.mjs` ignore 加 `erp/**`，同理
- `pnpm build` 通过，输出里能看到 `ƒ Proxy (Middleware)` 一行——proxy.ts 已识别

### 自测路线（你可以走一遍）
```
pnpm dev
→ http://localhost:3000
→ 点"免费试用" → 输邮箱 → 收件箱里有 6 位码
→ 输码 → 跳到 /dashboard，能看到 email
→ 点退出登录 → 回到首页
```

> Supabase 默认 OTP 邮件模板和 SMTP 在 dev 够用了。生产化要在 Supabase Auth 设置里接 Resend SMTP（之后某天再说）。

### Next
- Day 4: `/api/orgs` POST + `<CreateOrgDialog>`，首次登录自动给账号 bootstrap 一个组织 + `org_members` 行（role=`org_admin`）
- Day 5: `requireRole()` helper、`withOrg()` query helper、组织切换器、dashboard sidebar 骨架

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
