# 字段级锁 + 模板在场 (Coexistence Model)

## 解决什么问题

两个 admin 在同一个模板的详情页:
- 旧模型(0013):后进来的看到 "X is editing this template",整页只读,只能 Take Over 抢锁
- 新模型(0014):两个人都能编辑,只要不碰同一个字段。碰到时按字段级 423 阻塞

## 数据模型

```sql
form_templates
├── editing_sessions  jsonb   -- {user_id: {email, at}, ...} 谁在场
└── editing_fields    jsonb   -- {field_id: {user_id, email, at}, ...} 哪个字段被谁锁
```

两个 JSONB map,共用 2 分钟的 staleness 窗口。心跳是 10 秒一次 → 12 个心跳的容差,够覆盖网络抖动/tab 切换。

## 客户端

### `useTemplatePresence(formCode, heldFields)`

`src/hooks/use-template-lock.ts`

进 detail 页就调,每 10 秒 POST `/api/forms/templates/[code]/lock`:
- body 带 `{fields: [...]}` 告诉服务器我当前持有哪些字段锁
- 服务器写我自己的 session 槽 + 刷新这些字段锁的 `at`,返回完整 `sessions` + `editing_fields` 给我

卸载时 DELETE 释放(`keepalive: true` + `beforeunload` 双保险)。

返回:
```ts
{
  sessions: Record<userId, Session>,        // 所有在场的人
  editingFields: Record<fieldId, FieldLock>, // 所有字段锁
  others: Array<{user_id, ...session}>,     // 排除我自己
  myUserId: string | null,
}
```

### `useFieldLock(formCode, fieldId, active)`

`src/hooks/use-field-lock.ts`

用于明确的"我现在要编辑这个字段"场景。`active=true` 时 POST `/lock`;切到别的 fieldId 或 `active=false` 时 DELETE 旧的。

返回 `{ mode: 'idle' | 'holder' | 'busy' | 'error', takeover() }`。

> 实际目前在用的是 presence hook 的 `heldFields` 参数(批量、隐式);单字段 hook 留着备用,适合"编辑器开 modal 编辑一个字段"那种确定性场景。

## 服务端

### `POST /api/forms/templates/[code]/lock`

`src/app/api/forms/templates/[form_code]/lock/route.ts`

- 不再 409。固定成功
- 写 `editing_sessions[me] = {email, at: now}`
- 对 `body.fields` 里的每个 id:若未锁或锁主是我 → 刷新;否则保留(不强抢)
- 返回 sessions + editing_fields(都已 prune 过期项)

### `DELETE /api/forms/templates/[code]/lock`

- 删 `editing_sessions[me]`
- 清空所有锁主是我的 `editing_fields[*]`

### `POST /api/forms/templates/[code]/fields/[fid]/lock`

单字段抢锁/刷新。
- 已被他人锁住且新鲜 → 409 + `{holder}`,除非 body `{takeover: true}`
- 否则写 `editing_fields[fid] = {user_id, email, at}` 并返回 ok

### `PATCH /api/forms/templates/[code]`

不再用模板级锁判断。改为:
- 遍历 body 里的 `field_mapping` / `field_schema`,**只对真正变化的字段**检查锁
- 任一字段被他人锁住 → 423 `{error: "FieldLocked", fields: [...]}`
- 否则正常 upsert + 写 audit

## UI

- **PresenceBar**(`template-detail-editor.tsx`):有 `others.length > 0` 时显示黄条 "Also editing: alice@, bob@"
- **FieldSchemaEditor**(行级):被锁的行加 🔒、变 amber 背景、所有 input/checkbox/delete 都 disable
- **FormEditorOverlay**(layout 视图):被锁的字段 cell 加 🔒 角标、改 cursor、`onMouseDown` 不绑 → 拖不动
- **AcroFormMappingEditor**:与上同

## 失败模式 & 兜底

- 心跳网络失败 → 客户端 `beat()` 吞错,下一轮再试。2 分钟内没续心跳 → 服务端下次写入时把这个 session 当 stale 清掉
- Tab crash → `beforeunload` 不一定能发出去,但 staleness 兜底
- 同一个用户开多 tab → 多 tab 共享同一个 session 槽,heartbeat 互相覆盖。字段锁仍正确(因为 user_id 一致 → 当成"自己持有")

## 维护

- 调 staleness:改 `STALE_LOCK_MS`(`lock/route.ts`)。客户端心跳间隔在 `use-template-lock.ts` 的 `setInterval` 里
- 0013 留下的列(`editing_by`/`editing_by_email`/`editing_at`)不再读写,下个 cleanup migration 直接 `drop column`
