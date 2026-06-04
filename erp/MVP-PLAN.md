# Quill ERP · MVP Plan

> 8 周路线图。每天开工/迷路时回来看这份。
>
> **Status**: Draft · **Version**: 0.1 · **Owner**: Li Jianhua · **Started**: 2026-06-04

---

## 0. 与 Quill Permit 的关系

Permit 项目（`../`）原封不动继续跑——它已经能填政府表单、追到期、出 PDF。本目录是**全新独立项目**，目标是一套**跨区域通用 ERP**，首期切两个模块：

1. **Inventory & Warehousing**（库存仓储）
2. **Sales & Purchasing**（销售采购）

Permit 的代码不会被引入；如果将来 Permit 要并入 ERP 当作"合规模块"，那是 v2 的事。

---

## 1. TL;DR — 只读这段也够

我们要造的 ERP，必须在 8 周内跑通这条主流水线：

> 录入一个产品 → 入库 → 客户下采购单 → 我方发出销售单 → 出库 → 库存自动扣减 → 简单的应收应付台账。

中间所有环节都必须**多组织、多仓库、多币种、多计量单位**——不锁定地域，不预设税制。

**不做（v1 排除）：**

- 财务总账 / 复式记账（v2）
- 生产 / BOM / MRP（v2）
- HR / 工资 / 考勤（v2）
- CRM 商机管线（v2）
- 多租户 SaaS 订阅计费（先按 self-hosted/single-tenant 出货）
- 移动 App（PWA 即可）

**首期受众**：内部使用 + 1-2 家试点。8 周末不追求付费用户。

---

## 2. 推荐技术栈（待你确认）

### 2.1 前端

| 层 | 选型 | 理由 |
|---|---|---|
| Framework | **Next.js 16 App Router + TS** | 与 Permit 一致，熟悉成本最低，RSC 适合 ERP 大量列表场景 |
| Styling | **Tailwind v4 + shadcn/ui (Stone)** | 同上 |
| Forms | **react-hook-form + Zod** | ERP 表单复杂（多行明细、动态校验），react-hook-form 是事实标准 |
| Data grids | **TanStack Table v8** | ERP 离不开高密度表格（排序/筛选/列设置/分页），shadcn 提供模板 |
| State | **Zustand**（仅 UI 状态）+ **TanStack Query**（服务端缓存） | RSC 拉首屏，Query 处理交互后增量 |
| Drag & Drop | **dnd-kit**（按需引入） | 拣货单、订单行排序 |

### 2.2 后端 & 数据

| 层 | 选型 | 理由 |
|---|---|---|
| DB host | **Supabase Postgres** | 沿用 Permit 同账号、同 storage、同 auth |
| ORM | **Drizzle ORM** ⚠️ 与 Permit 不同 | ERP 业务逻辑复杂，需要事务嵌套、CTE、窗口函数；Drizzle 让 SQL 一等公民，类型安全；比 Prisma 在批量更新和原生 SQL 处更顺手 |
| Auth | **Supabase Auth (Email OTP + Magic Link)** | 沿用 |
| Storage | **Supabase Storage** | 沿用——单据附件、产品图 |
| 权限 | **应用层 RBAC**，**不用 RLS** | ERP 角色多（Sales/Warehouse/Finance/Admin），用 RLS 写不出干净的策略；应用层 + middleware 守门 |
| Background jobs | **Vercel Cron** + **Supabase pg_cron** | 库存重算、汇率刷新、AR/AP 账龄 |
| Email | **Resend** | 沿用——发订单确认 PDF |
| PDF | **pdf-lib** + **@react-pdf/renderer**（评估） | 销售单/采购单/送货单/对账单 |
| Validation | **Zod** | 沿用 |
| AI | **Anthropic SDK + Google Vision** | 凭证/发票 OCR 自动入账（v1.5） |
| Testing | **Vitest**（单元 + 业务逻辑）+ **Playwright**（关键流程 E2E） | ERP 的库存/金额计算必须有测试覆盖 |

### 2.3 Deployment

- Web: **Vercel**
- DB/Storage: **Supabase**
- 域名: 待定（建议 `erp.lj-group.internal` 或子域）

### 2.4 与 Permit 栈的关键差异

- **Drizzle 代替直连 Supabase SDK**——ERP 的事务边界不能交给客户端拼 SQL
- **RBAC 代替 RLS**——多角色协作场景下 RLS 会写成天书
- **TanStack Query**——Permit 几乎不需要客户端缓存，ERP 离不开

---

## 3. 核心数据模型（V1）

> 取舍原则：从 day 1 就支持多组织、多仓库、多币种、多 UoM；但**先不上**多税制引擎、生产 BOM、批次/序列号——这些留接口位即可。

### 3.1 主体与组织

```
organizations          组织 / 法人主体（一个用户可属多个）
org_members            (user_id, org_id, role)  -- RBAC 中枢
parties                公司或个人；通过 party_roles 标记客户/供应商/两者
party_addresses        多地址（开票/发货/收货）
party_contacts         联系人
currencies             ISO 4217 表（种子数据）
exchange_rates         (org_id, base, quote, rate, effective_date)
```

### 3.2 库存

```
warehouses             (org_id, code, name, address, timezone)
warehouse_bins         (warehouse_id, code) -- 可选位号
uoms                   每、千克、箱、米…（种子 + 自定义）
uom_conversions        (from_uom, to_uom, factor, item_id NULL=通用)
items                  SKU、名称、类型(goods/service)、stock_uom、is_serialized、is_lot_tracked
item_warehouse_stock   (item_id, warehouse_id, qty_on_hand, qty_reserved) -- 物化视图/触发器维护
stock_movements        ⭐ append-only 凭据账
                       (id, org_id, item_id, warehouse_id, bin_id NULL,
                        qty (+/-), uom_id, reason CHECK IN
                        ('receipt','issue','transfer_in','transfer_out',
                         'adjustment_in','adjustment_out','sale','purchase','return'),
                        source_doc_type, source_doc_id, occurred_at, created_by)
stock_batches          (可选) FIFO/Avg 成本批次
```

> **黄金规则**：库存数量只能通过插入 `stock_movements` 改变。所有可见量从 `item_warehouse_stock` 读，由触发器或后台任务从 movements 重算。

### 3.3 销售 / 采购

```
document_sequences     (org_id, doc_type, year, next_number, format)
                       -- 生成 SO-2026-0001, PO-2026-0001 …
sales_orders           header: customer (party), order_date, expected_ship_date,
                       currency, exchange_rate, status, totals
sales_order_lines      item, qty, uom, unit_price, discount, tax_rate, line_total
purchase_orders        header: vendor (party), order_date, expected_receipt_date,
                       currency, exchange_rate, status, totals
purchase_order_lines   …
shipments              SO → 多次发货；每次发货生成 stock_movements(sale, -qty)
goods_receipts         PO → 多次收货；每次收货生成 stock_movements(purchase, +qty)
invoices_sales         (sales_order_id, party, totals, paid_amount, status)
invoices_purchase      (purchase_order_id, party, totals, paid_amount, status)
payments_received      (invoice_id, amount, method, occurred_at)
payments_made          (invoice_id, amount, method, occurred_at)
```

### 3.4 通用

```
audit_log              所有写操作的事后审计（actor, doc_type, doc_id, change, at）
attachments            (target_type, target_id, storage_path)
notes                  自由备注
```

### 3.5 RBAC 角色（V1）

| Role | 能做 |
|---|---|
| `org_admin` | 全部 + 组织设置 / 成员 |
| `sales` | 客户、销售单、发货、销售发票、收款 |
| `purchasing` | 供应商、采购单、收货、采购发票、付款 |
| `warehouse` | 库存调拨、入出库、盘点 |
| `viewer` | 只读全部 |

---

## 4. 8 周路线

每周末做一次 60 秒自录 demo，存 `demos/week-N.mov`。

### Week 1 · 地基

| Day | 任务 |
|---|---|
| 1 | `erp/` 项目脚手架：Next.js 16 + shadcn + 目录 + landing 页 |
| 2 | Supabase 项目（独立于 Permit）+ env + Drizzle 接入 |
| 3 | Auth：Email OTP，登录/注册页，`org_members` 注入 |
| 4 | 数据库迁移 0001：organizations、org_members、parties、currencies 种子 |
| 5 | RBAC middleware + `/dashboard` 框架 + 组织切换器 |
| 6 | Vercel 部署，子域绑定 |
| 7 | 内部自测，**Week 1 Demo** |

### Week 2 · 主数据

| Day | 任务 |
|---|---|
| 1 | 迁移 0002：uoms（种子）+ uom_conversions + items |
| 2 | Items CRUD（列表 + 详情 + TanStack Table） |
| 3 | 迁移 0003：warehouses + warehouse_bins |
| 4 | Warehouses CRUD + 切换器 |
| 5 | 迁移 0004：party_roles + party_addresses + party_contacts |
| 6 | Parties 统一 CRUD（按 role 过滤呈现） |
| 7 | **Week 2 Demo**：录入一个产品、一个仓库、一个客户、一个供应商 |

### Week 3 · 库存核心

| Day | 任务 |
|---|---|
| 1 | 迁移 0005：stock_movements + item_warehouse_stock + 触发器 |
| 2 | `/api/inventory/movements` POST（带事务 + 单元测试） |
| 3 | 入库 UI（manual receipt）+ 出库 UI（manual issue） |
| 4 | 调拨 UI（transfer = issue + receipt 原子事务） |
| 5 | 盘点 UI（adjustment 正负） |
| 6 | 库存余额报表（按仓库 / 按产品 / 累计） |
| 7 | **Week 3 Demo**：录入 10 个动作，余额对得上 |

### Week 4 · 采购流水线

| Day | 任务 |
|---|---|
| 1 | 迁移 0006：document_sequences + purchase_orders + purchase_order_lines |
| 2 | PO 创建/编辑（多行明细 + 自动编号） |
| 3 | PO PDF 渲染 + Resend 邮件外发 |
| 4 | 迁移 0007：goods_receipts；收货 UI → 自动 stock_movements(purchase) |
| 5 | 部分收货、超收提醒、PO 状态机 |
| 6 | 简版 invoices_purchase + payments_made + AP 台账 |
| 7 | **Week 4 Demo**：完整跑一遍采购→收货→库存增加→付款 |

### Week 5 · 销售流水线

| Day | 任务 |
|---|---|
| 1 | 迁移 0008：sales_orders + sales_order_lines |
| 2 | SO 创建（含库存可用量校验，预留 qty_reserved） |
| 3 | SO PDF + 邮件外发 |
| 4 | 迁移 0009：shipments；发货 UI → 自动 stock_movements(sale) |
| 5 | 部分发货、退货（return）流程 |
| 6 | 简版 invoices_sales + payments_received + AR 台账 |
| 7 | **Week 5 Demo**：完整跑一遍销售→发货→库存减少→收款 |

### Week 6 · 多币种 + 汇率 + 报表

| Day | 任务 |
|---|---|
| 1 | exchange_rates 表 + 每日 cron 拉汇率（fixer/openexchangerates） |
| 2 | 单据创建时锁汇率，报表用本位币换算 |
| 3 | 销售/采购汇总报表（按客户/供应商/产品/期间） |
| 4 | AR/AP 账龄报表（0-30 / 31-60 / 61-90 / 90+） |
| 5 | 库存周转率（出库均量 / 平均库存） |
| 6 | 报表导出 Excel（xlsx） |
| 7 | **Week 6 Demo** |

### Week 7 · 多组织 + 权限打磨

| Day | 任务 |
|---|---|
| 1 | 组织切换在所有页面生效（Zustand + URL ?org=） |
| 2 | 邀请成员（邮件 + 角色选择） |
| 3 | RBAC 全站审查：每个 API 都按角色守门 |
| 4 | 审计日志（audit_log）+ 查看页 |
| 5 | 附件与备注：每张单据可挂文件、加备注 |
| 6 | 数据导入：CSV 批量导入产品、客户、供应商 |
| 7 | **Week 7 Demo** |

### Week 8 · 打磨 + 试点

| Day | 任务 |
|---|---|
| 1-2 | UI 一致性 sweep（empty state / loading / error / mobile） |
| 3 | 移动端适配（关键流程：查库存、收货、发货） |
| 4 | 录 5 分钟 demo 视频 |
| 5 | landing 页 / 内部介绍 |
| 6-7 | 与 1-2 家试点对接，反馈修复。**MVP 完成** |

---

## 5. 工作约定

### 5.1 硬规矩

- ✅ TS 全覆盖
- ✅ 每完成一个任务一个 git commit
- ✅ 每加一个 env 进 `.env.local.example`
- ✅ 决策记 `docs/DECISIONS.md`
- ✅ 库存/金额/汇率代码必须有 Vitest 单测
- ✅ 数据库变更走 migration，**不允许在控制台手改**
- ❌ 不引入 RLS（统一应用层 RBAC）
- ❌ 不提前抽象、不重构未运行的代码
- ❌ Week 6 之前不引入 ESLint/Prettier 之外的代码规范

### 5.2 每天循环

```
早 15 min:  读 docs/CHANGELOG.md → 选今天任务 → 写好 "今天做什么"
工作 3-4h:  小步验证，每步可运行
末 10 min:  写 CHANGELOG → git push
```

### 5.3 卡住时

- 精确描述错误，别说"不工作"
- 用 `explain this code` 代替 `fix it`
- 同一问题 3 次失败 → 站起来走 10 分钟
- 想"顺手重构"时 → 写进 TODO，不要动

---

## 6. 风险登记

| 风险 | 缓解 |
|---|---|
| 库存重算/触发器写错导致余额漂移 | Vitest 覆盖全部 movement → balance 用例；定期校对作业（夜间） |
| 多币种汇率源不稳定 | 至少 2 个备源；汇率缺失时单据禁用，不静默回退 |
| RBAC 漏门 | API 层统一 `requireRole(['sales','admin'])`，单测每条路由 |
| Drizzle 学习成本 | Week 1 Day 2 留半天读官方文档；遇到 ORM 限制就直接 raw SQL |
| 多组织数据串扰 | 所有查询强制 `org_id =`，写 `withOrg()` helper 强制 |

---

## 7. v2 候选（不在 8 周内）

- 生产 / BOM / MRP
- 财务总账 + 复式记账 + 报表（资产负债表/损益表）
- HR / 工资 / 社保
- CRM 商机管线 + 邮件追踪
- 多租户订阅计费
- 移动端原生 App
- 与 Quill Permit 合并：把"政府合规"做成 ERP 的一个模块

---

## 8. 待你拍板的点

1. **技术栈**：Drizzle + RBAC 这套，能接受吗？还是想换 Prisma/Supabase RLS？
2. **目标行业**：通用 ERP 范围太广，要不要先内心默认一个画像（贸易 / 零售 / 轻制造）？这会影响 UI 默认字段。
3. **币种与地域**：第一阶段默认本位币是 **CNY / USD / PHP**？
4. **试点对象**：Week 8 谁来用？这决定 Week 7 的导入工具要支持什么数据源。
5. **域名**：临时用 `erp.getquill.ai` 还是另起？

确认后 Week 1 Day 1 立刻开工。
