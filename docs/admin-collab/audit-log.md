# 审计日志

## 解决什么问题

"上周谁把 BIR_2550M 的 tin_number 字段删了?"

之前:没法查,只能猜。

现在:`/admin/audit` 一搜就有,带 before/after diff。

## 数据模型

```sql
audit_log (
  id          bigserial primary key,
  actor_id    uuid → auth.users (nullable, set null 防止级联删账号丢历史)
  actor_email text,
  action      text,        -- 'template.update_metadata' 等
  target_kind text,        -- 'form_template' / 'form_template_field'
  target_id   text,        -- form_code 或 form_code:field_id
  before      jsonb,
  after       jsonb,
  at          timestamptz default now()
)

-- 三个常用查询轴
index on (target_kind, target_id, at desc)
index on (actor_id, at desc)
index on (at desc)
```

RLS **不开**。理由:admin allowlist 在 env vars 里,RLS 看不到 → 改用 API 层 `isAdminEmail()` 把关。

## 已覆盖的 action

| action | 触发点 |
|--------|--------|
| `template.update_metadata` | PATCH `/api/forms/templates/[code]` 且改了 form_name/agency/frequency/description/is_active/source_url |
| `template.update_schema` | 同上,改了 field_schema |
| `template.update_field_mapping` | 同上,改了 field_mapping |
| `template.replace_pdf` | POST `/api/forms/templates/[code]/replace-pdf` |
| `template.delete` | DELETE `/api/forms/templates/[code]` |
| `template.lock_takeover` | 字段级 lock 的 takeover(在 0014 改造前的模板锁也会写;留在 lock route 里) |

> 想加新 action:`src/lib/audit/log.ts` 里加到 `AuditAction` 类型 → 在对应 route 里调 `logAudit(...)`。

## 写入

`src/lib/audit/log.ts`:

```ts
export async function logAudit(supabase, entry: AuditEntry): Promise<void> {
  try {
    await supabase.from("audit_log").insert({ ... })
  } catch {
    // 永不抛。审计写失败不能拖垮原请求
  }
}
```

最重要的不变量:**logAudit 永不抛错**。不会因为 audit_log 表不在或权限问题导致 PATCH 失败。

## 读取

### API:`GET /api/admin/audit`

`src/app/api/admin/audit/route.ts`

参数(全部可选):
- `target_kind` / `target_id` / `actor_id`
- `limit`(默认 100,上限 500)

返回 `{entries: AuditEntry[]}` 按时间倒序。

### UI:`/admin/audit`

`src/app/(dashboard)/admin/audit/page.tsx`(SSR shell)+ `src/components/admin/audit-log-viewer.tsx`(client 内容)

特性:
- 三个筛选输入:actor email(模糊)、action(下拉)、target_id(模糊)
- 30 秒自动 refresh
- 每行可展开,左右两栏 JSON diff(`before` / `after`)

## 测试

1. 任何 admin 操作:改个 metadata、改字段 label、Replace PDF 等
2. 立刻去 `/admin/audit` → 最上面有新条目
3. 点 ▶ 展开 → before / after 两栏 JSON,能看到具体哪个字段从 X 变成 Y
4. 上方筛选 Actor email = 自己,Action = "Layout / mapping" → 只剩你刚才的 layout 改动

## 已知限制

- before/after 是**整体快照**(整个 field_schema 或 field_mapping),不是字段级 diff。UI 上做精细 diff 可读性更好,留给后续。
- 每个 PATCH 最多写 3 条 audit(metadata / schema / mapping 各一)。批量改时不去重 → 写入量可控
- 没有保留期 / TTL 清理。表会一直涨。需要 GC 的话起 cron:`delete from audit_log where at < now() - interval '180 days'`
