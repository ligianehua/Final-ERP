# Admin Collaboration Features

这一批 feature 让多个 admin 能同时在同一个模板上工作而不会互相覆盖,同时把用户填表的草稿同步到云端,并把所有 admin 写操作记下来留痕。

## 文档索引

| 文档 | 内容 |
|------|------|
| [`field-locks.md`](./field-locks.md) | 模板在场 + 字段级锁(coexistence model) |
| [`acroform-editor.md`](./acroform-editor.md) | AcroForm 模板的 widget 映射编辑器 |
| [`cloud-drafts.md`](./cloud-drafts.md) | 填表草稿的 localStorage + DB 双写同步 |
| [`audit-log.md`](./audit-log.md) | Admin 模板编辑的审计日志 |

## 一句话总结

- **字段锁**:多 admin 同模板共编;按字段加锁;PATCH 只检查被改动的字段
- **AcroForm 编辑器**:之前是 stub,现在是真编辑器,下拉里列 PDF 内嵌 widget
- **云端草稿**:localStorage 还在(主、离线),加云端副本(2s 节流),换设备能续传
- **审计**:`form_templates` 上所有 admin 写操作 → `audit_log` 表 → `/admin/audit` 页面

## 涉及的数据库 migration

按顺序跑(或都用 `if not exists`,重跑安全):

1. `supabase/migrations/0013_template_editing_lock.sql` — 初版独占锁。列还在表上,但**不再被读**。0014 之后失效。
2. `supabase/migrations/0014_field_locks_drafts_audit.sql` — 当前生效的模型。加 `editing_sessions` / `editing_fields` 两个 JSONB 列、`form_drafts` 表、`audit_log` 表。

部署:

```bash
# 选项 A:Supabase CLI
supabase link --project-ref <ref>
supabase db push

# 选项 B:Web SQL Editor — 直接粘 sql 文件内容 → Run
```

## 验收清单(端到端)

启动 dev server (`pnpm dev`),登录两个 admin 账号:

- [ ] 两浏览器同时打开 `/admin/templates/<某模板>` → 顶部出现 "Also editing: <对方>" 黄条
- [ ] A 拖某字段 → B 端 10 秒内看到那个字段有 🔒,拖不动
- [ ] A 释放(改完或退页) → B 端那个字段自动解锁
- [ ] 任意 admin 改个 metadata → `/admin/audit` 出现一条 `template.update_metadata`
- [ ] AcroForm 模板的详情页有 "AcroForm mapping" 卡片(不再是灰色提示)
- [ ] `/forms/fill` 填一半,手机端打开同账号同 slot → 弹 restore 黄条
- [ ] 提交后,云端草稿 + localStorage 都被清掉

## 已知遗留

- `form_templates.editing_by` / `editing_by_email` / `editing_at`(0013 加的)还在表上,新代码不再写也不再读。下一个 cleanup migration 可以 `drop column`。
- AcroForm 编辑器目前只支持 text/checkbox/radio/dropdown 四种 widget 类型;签名域、按钮等被归到 `other`,UI 仍可选但 render 端不一定支持。
