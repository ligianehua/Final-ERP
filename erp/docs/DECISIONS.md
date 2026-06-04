# Quill ERP · Decision Log

> 每个重要技术决策一条。日期 + 选了什么 + 拒绝了什么 + 理由。
> 写在这里是为了未来的自己别再问"当初为什么"。

---

## 2026-06-04 · 沿用 Next.js 16 + Tailwind v4 + shadcn

**选了**：与 Permit 项目同栈（Next.js 16 App Router + Tailwind v4 + shadcn/ui Stone）。
**没选**：Remix、SvelteKit、纯 Vite + React。
**为什么**：团队已熟，learning cost 为零；RSC 适合 ERP 的高密度列表场景；shadcn 让我们能两周搭出可用的中后台 UI。

---

## 2026-06-04 · 数据访问用 Drizzle ORM，**不**用 Supabase RLS

**选了**：Supabase 仅作为托管 Postgres + Auth + Storage；查询走 Drizzle（schema + queries 都是 TS 一等公民）。
**没选**：Prisma（事务嵌套不顺手）、直接 `@supabase/supabase-js`（业务逻辑会泄漏到客户端）、RLS 做行级权限。
**为什么**：
- ERP 角色多（org_admin / sales / purchasing / warehouse / viewer），RLS 策略会写成迷宫
- 复杂事务（多明细单据、库存扣减、汇率换算）需要在应用层有完整控制流
- Drizzle 让 SQL CTE / 窗口函数 / `INSERT … RETURNING` 都拼得出来，类型还推得回来
- Migration 用 `drizzle-kit`，不在 Supabase Studio 手改

**实施约束**：
- 所有 API route 必须经过 `requireRole(orgId, roles[])` 守门
- 所有跨组织数据查询必须 `where(eq(t.org_id, currentOrgId))`，写一个 `withOrg()` helper 强制
- 不写直接命中数据库的 client 组件——客户端只通过 API route

---

## 2026-06-04 · 多组织 + 多币种 + 多 UoM 从 Day 1

**选了**：所有表带 `org_id` FK；金额字段都附 `currency_code`；库存量都附 `uom_id`。
**没选**：单组织 + 单本位币的简化版 v1，留到 v2 改造。
**为什么**：跨区域 ERP 的本质需求；事后改造会动整张库存账、整套报表。痛苦前置。

**实施约束**：
- 单据 header 存 `currency_code` 和 `exchange_rate_at_creation`，所有报表用本位币换算
- 本位币 per 组织（`organizations.base_currency`），不是全局
- 默认支持 **CNY / USD / PHP** 三币种（种子数据）；其他按需添加

---

## 2026-06-04 · 库存量只能通过 `stock_movements` 改变

**选了**：append-only 凭证账（stock_movements）+ 物化余额表（item_warehouse_stock），后者由触发器或后台任务从前者重算。
**没选**：直接 UPDATE `items.qty_on_hand`。
**为什么**：ERP 库存核算的核心正确性来自"任何改变都能溯源"。直接 UPDATE 会让对账成为不可能。

**实施约束**：
- 所有应用代码改库存都走 `recordStockMovement(...)` helper
- Vitest 测试覆盖：随机生成 N 条 movements → 重放后余额必须 = 余额表
