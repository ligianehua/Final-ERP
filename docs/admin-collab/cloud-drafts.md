# 填表云端草稿

## 解决什么问题

用户在电脑上填了一半 BIR 表单,关了 tab 去开会。回来继续 → ok,localStorage 还在。

新场景:用户在电脑上填了一半,出门坐地铁,想用手机继续 → 之前的 localStorage 在原电脑上,手机看不到。

## 设计:双轨

| 轨道 | 触发 | 用途 |
|------|------|------|
| **localStorage**(保留) | 600ms 节流 | 主、离线、即时回填 |
| **云端 `form_drafts`** | 2s 节流 | 跨设备续传 |

两边 key 一致:`(user_id, form_code, company_id, signatory_id)`。云端用 unique index + COALESCE(空 UUID) 模拟 nullable 列上的 unique。

## 数据模型

```sql
form_drafts (
  user_id      uuid not null → auth.users
  form_code    text not null
  company_id   uuid → companies (nullable)
  signatory_id uuid → company_people (nullable)
  values       jsonb,
  overrides    jsonb,
  period       text,
  updated_at   timestamptz default now()
)

unique index on (user_id, form_code,
                 coalesce(company_id, '00000000-...'),
                 coalesce(signatory_id, '00000000-...'))
```

RLS:user 只能看/写自己的行。

## API

`src/app/api/forms/drafts/[form_code]/route.ts`

| Method | 用途 |
|--------|------|
| `GET ?company_id=&signatory_id=` | 取这个 slot 的云端草稿,没有返回 `{draft: null}` |
| `PUT` | upsert(因为 unique 用了 COALESCE 表达式,Supabase 的 onConflict 用不了 → 先 update 再 insert) |
| `DELETE` | 删这个 slot |

## 客户端流程

`src/components/forms/fill-flow.tsx`(直接改原文件,不引入新 hook)

### 进 slot 时

```
1. setDraftWritable(false)
2. 同步读 localStorage → localDraft
   - 有 → setPendingDraft(localDraft)
   - 无 → setDraftWritable(true)
3. 并行 fetch cloudDraftUrl()
   - 如果 cloud.updated_at > local.saved_at → 用 cloud 覆盖 pendingDraft
   - 否则忽略 cloud(stale)
```

`pendingDraft` 触发顶部 "You have an unsaved draft..." 黄条。点 Restore → 灌进 state、setDraftWritable(true)、清 pending。点 Discard → 删 localStorage + 删云端。

### 编辑时

`useEffect([values, overrides, period, ...])` 里起两个 timer:

```
- 600ms 写 localStorage
- 2000ms PUT 云端
```

cleanup 时两个 timer 都清。

### 提交成功

删 localStorage + DELETE 云端 → 下次进 slot 不会再弹 restore。

## 节流的取舍

- localStorage 设 600ms:用户连续按键时 6 帧之后落盘,基本无感
- 云端设 2000ms:不想每个字符一次 HTTP。大约一句话一次

如果想再调:`fill-flow.tsx` 的两个 `setTimeout`。

## 失败模式

| 场景 | 表现 |
|------|------|
| 完全离线 | 云端 PUT fail,localStorage 正常,UI 无感 |
| 云端 PUT 5xx | 吞错,下次编辑下次重试。本地依然有 |
| 云端 GET fail | 当 cloud=null,只看 localStorage,无感 |
| 云端比 local 旧 | `cloudTs <= localTs` 时不覆盖 pendingDraft |
| 同 slot 同设备两 tab 编辑 | localStorage 互相覆盖(typical browser),云端按最后写入。该 slot 同人允许竞写 |

## 测试

1. Chrome 进 `/forms/fill`,填 3~4 个字段,等 2 秒以上 → DevTools Network 应看到 `PUT /api/forms/drafts/<code>?...` 200
2. Supabase Dashboard → Table Editor → `form_drafts` 应看到这一行
3. Safari 同账号同 slot 进 → 顶部黄条出现,时间戳是 Chrome 的
4. 点 Restore → 字段值跟 Chrome 一致
5. 提交保存 → `form_drafts` 表那一行消失;localStorage 也清

## 维护

- 加新 slot 维度(比如多年度填同一表):改 unique index + 三处 `cloudDraftUrl()` 的 query 参数 + slot tuple
- 想引入服务端 GC(超过 30 天的旧草稿)→ 加个 cron 跑 `delete from form_drafts where updated_at < now() - interval '30 days'`
