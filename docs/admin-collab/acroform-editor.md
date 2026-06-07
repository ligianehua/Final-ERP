# AcroForm 模板映射编辑器

## 背景

模板有两种 mapping 策略:

| strategy | 含义 | 编辑器 |
|----------|------|--------|
| `coordinates` | schema 字段 → PDF 上的绝对坐标 | 拖拽 WYSIWYG(`FormEditorOverlay`) |
| `acroform` | schema 字段 → PDF 内嵌 AcroForm widget 的名字 | 之前是 stub;现在是本编辑器 |

AcroForm 字段的位置烧死在 PDF 里(widget annotation),不可拖拽。能编的只有"哪个 schema 字段填进哪个 widget"。

## 实现

### Widget 名字怎么来的

`src/lib/forms/templates/acroform-fields.ts` — 用 `pdf-lib` 读 PDF 的 `AcroForm` 字段,返回 `{name, kind}[]`。kind 映射:

| pdf-lib 类 | kind |
|-----------|------|
| `PDFTextField` | `text` |
| `PDFCheckBox` | `checkbox` |
| `PDFRadioGroup` | `radio` |
| `PDFDropdown` | `dropdown` |
| 其它(签名/按钮等) | `other` |

`GET /api/forms/templates/[code]/acroform-fields` 是这个 lib 的 admin-only HTTP 入口。

为了让 route 能拿到 PDF bytes,把 `loadTemplateBytes` 从 `render-on-template.ts` 改成 export(原来是 private)。

### 组件

`src/components/admin/acroform-mapping-editor.tsx`

- 进页面就 fetch widget 列表,loading 期间显示 "Loading…"
- 表格三列:`field_id` / `label` / dropdown(初始选中已映射的 widget)
- 改动入 `touched: Set<string>` → 通过 `onActiveFieldsChange` 上报给父组件,纳入 presence 心跳的 heldFields
- 下面一个 "X 个 PDF widget 没映射到任何 schema field" 提示框
- `Save mapping` → PATCH `/api/forms/templates/[code]` with `{field_mapping: ...}`

### TemplateDetailEditor 的分支

`template-detail-editor.tsx`:

```tsx
{fieldSchema && template.mapping.strategy === "coordinates" && (
  <FormEditorOverlay ... />
)}
{fieldSchema && template.mapping.strategy === "acroform" && (
  <AcroFormMappingEditor ... />
)}
```

两种策略互斥渲染。

## 字段锁集成

跟 `FieldSchemaEditor` 一样:

- `fieldLocksByOther` prop 接受 `{field_id: {email, at}}`
- 被锁的行:🔒 角标 + dropdown disable + amber 行背景
- `onActiveFieldsChange(touchedIds)` 让父组件把这些字段并入 presence heartbeat

## 测试

1. 找一个 `strategy: "acroform"` 的模板(如果没有,可以 admin 上传一个带 AcroForm 的 PDF)
2. `/admin/templates/<code>` 应该看到 **AcroForm mapping** 卡(不是灰色"acroform fields..."字样)
3. 改一个映射(例如把 `tin_number` 从 widget A 改成 widget B)→ Save
4. 去 `/forms/fill` 选这个模板填一下 → 提交 → 下载 PDF 看 `tin_number` 的值有没有落到 widget B 的位置

## 已知限制

- PDF 解析在请求线程里同步做,大 PDF 慢 → 可加缓存(Storage 上传时缓存到 DB 一列)
- `other` 类型(签名/按钮等)仍可选,但 `render-on-template.ts` 只调 `getTextField`,所以非 text 类型可能没效果 → 后续 render 端也要分支
