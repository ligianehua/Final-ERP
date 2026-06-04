# Quill ERP · Changelog

> 每天结束写一条。新条目顶到最上。

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
