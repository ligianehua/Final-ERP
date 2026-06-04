# Quill · Changelog

> Daily progress log. Add an entry at end of each working session.

---

## Week 1, Day 1 — 2026-05-22

### Done
- Project bootstrapped: Next.js 16 (App Router) + TypeScript + Tailwind v4
- shadcn/ui configured manually (Stone theme, CSS variables)
- Core UI components created: Button, Input, Label, Card
- Full project directory structure established
- Type definitions for all 6 DB entities (Company, CompanyPerson, Document, FormTemplate, FormSubmission, Reminder)
- AI result types: AIFormRecognitionResult, AIFieldMappingResult, AIDocumentExtraction
- Landing page built (hero + 3 features + footer, Quill branding)
- `docs/DECISIONS.md` created
- `.env.local.example` created with all required env vars
- `components.json` (shadcn config) created

---

## Week 1, Day 2 — 2026-05-22

### Done
- Installed `@supabase/supabase-js` + `@supabase/ssr`
- `src/lib/db/client.ts` (browser) + `src/lib/db/server.ts` (server)
- Login + Signup pages with email OTP (2-step flow)
- `/api/auth/callback` route for session exchange

---

## Week 1, Day 3-5 — 2026-05-22

### Done
- **Day 3 (Auth)**: Login/signup pages wired to Supabase OTP; route protection
- **Day 4 (Schema)**: `companies` table migration + 4 RLS policies; applied in Supabase
- **Day 5 (CRUD)**:
  - API: `GET/POST /api/companies`, `GET/PATCH/DELETE /api/companies/[id]`
  - Zod validation (`src/lib/validations/company.ts`)
  - Dashboard layout (Topbar + Sidebar), sign-out action
  - Companies list page (empty state + grid)
  - Create-company dialog form
  - Company detail page + delete confirmation
- **Next.js 16 migration**: renamed `middleware.ts` → `proxy.ts` (heeded deprecation)
- UI components added: Dialog (+ tw-animate-css)

### Next
- Day 6: Vercel deploy + custom domain
- Day 7: Test from phone, polish. **Week 1 Demo**.
- Then Week 2: company_people + documents + Storage upload

---

## Week 2, Day 1 — 2026-05-25

### Product direction (decided this session)
- Entry is **form-first** (Flow B): user uploads a form → AI says what's needed.
- Archive is the reusable backbone: **company profile + people roster + document library**.
- Materials vary by form AND by signer; archive doesn't pre-fix a set — filing pulls from it on demand.
- Creation is intentionally minimal: pick `Individual`/`Company` + name. Profile fields fill via document upload (Week 2-3 AI extraction).

### Done
- DB: `0002_companies_entity_type.sql` — add `entity_type` + sss/philhealth/pagibig columns to companies
- DB: `0003_documents.sql` — documents table + 4 RLS policies + indexes
- Types: `EntityType`, updated `Company`, refined `DocumentType` + `DocumentFolder` for PH context
- Validation: split into `companyCreateSchema` (minimal: type+name) and `companyUpdateSchema` (full)
- API: `POST /api/companies` now accepts entity_type
- UI: rewrote `CreateCompanyDialog` — Individual / Company toggle + single name field
- UI: list cards show entity-type icon + badge; detail page tailors fields per type
- "Companies" page copy updated to reflect archive-of-both concept

### Next
- Day 2-3: Supabase Storage bucket setup + file upload UI
- Day 4: document list / preview / download / delete
- Day 5: 5-folder organization + filter
- Day 6: company_people (officers/employees roster)
- Day 7: polish + **Week 2 Demo** (upload a real Mayor's Permit)

---

## Week 2, Day 2 — 2026-05-28

### Done
- DB: `0004_storage.sql` — `documents` Storage bucket (private) + 4 RLS policies (path-scoped to user's UUID folder)
- Validation: `documentCreateSchema` + friendly label maps + per-type default folder
- API: `GET/POST /api/documents` (list + create-record-after-upload)
- API: `DELETE /api/documents/[id]` (removes both Storage object and DB row)
- UI: `UploadDocumentDialog` — file picker (PDF/JPG/PNG, 10 MB max), doc type select, folder auto-fills from type, client-side upload to Storage then POST to record
- UI: `DocumentList` — per-row download (signed URL) + delete; empty state
- Detail page: added Documents card with upload button + list

### Next
- Day 4: preview pane (in-app PDF/image viewer instead of new tab)
- Day 5: filter by folder + search
- Day 6: company_people (officers/employees roster)
- Day 7: polish + **Week 2 Demo**

---

## Week 2 Mid — 2026-05-28 (Week 3 jumpstart)

### Done — Editable profile
- `EditCompanyDialog` — type-aware (Company shows SEC; Individual shows SSS/PhilHealth/Pag-IBIG)
- Empty strings normalize to NULL on save

### Done — AI extraction pipeline (the magic!)
- **Provider-agnostic** AI layer: OpenAI SDK pointed at any compatible gateway via `AI_BASE_URL` + `AI_API_KEY` + `AI_MODEL`. Default: silra.cn + glm-5.1.
- `src/lib/ai/client.ts` — unified client
- `src/lib/ai/prompts.ts` — versioned (`DOCUMENT_EXTRACTION_PROMPT_V1`)
- `src/lib/ai/extract-document.ts` — sends image data URL, parses JSON, validates with zod
- `POST /api/documents/[id]/extract` — downloads file from Storage → base64 → AI → cache result on document row
- UI: Sparkles button on each image document → loading state → results dialog with checkboxes
- Results dialog: shows extracted fields vs current profile values, user picks what to apply, PATCH to /api/companies/[id]
- Restriction: images only (JPG/PNG) for v1. PDF support planned (needs server-side pdf-to-image)

### What user needs to set
- `AI_API_KEY` in .env.local (their silra.cn key)
- `AI_MODEL=glm-5.1` or `MiniMax-M2.5` (whichever they prefer)
- Restart dev server to pick up env changes

### Next
- Test extraction on a real BIR 2303 image
- Day 4-7 plan: preview, filter, people roster, demo

---

## Week 6 Mid — 2026-06-01 — Multi-format → PDF conversion

### Why
Forcing customers to convert XLS/DOC into PDF before upload is bad UX. The
server should accept whatever they have. Same pipeline also bakes our
own system-shipped templates (starting with BIR 2550M).

### Done
- `src/lib/convert/supported.ts` — extension whitelist (Office docs,
  spreadsheets, presentations, plain text, HTML, JPG/PNG, passthrough PDF)
- `src/lib/convert/to-pdf.ts` — Office → `soffice --headless`, images →
  pdf-lib single-page A4, PDF → passthrough; per-call temp dir +
  isolated LibreOffice user profile (no concurrency lock collisions)
- `POST /api/convert/to-pdf` — auth-gated multipart endpoint, 25 MB cap,
  90 s timeout, `runtime = "nodejs"`
- `scripts/convert-template.mjs` — dev-time tool for baking system
  templates; produced `public/form-templates/BIR_2550M.pdf` (6 pages,
  PDF-1.7) from the official BIR XLS
- `docs/DECISIONS.md` — entry on why LibreOffice over Gotenberg / cloud
  conversion APIs + the production-image requirement

### Deployment note
Routes that use this lib need a host where the runtime image carries
`libreoffice-calc` + `libreoffice-writer`. Plain Vercel won't fit; a
Docker target (Fly.io / Railway / self-hosted) does.

### Next
- Wire the endpoint into a template-upload UI for admins (deferred —
  separate ticket)
- Continue Week 6 form-fill polish on top of the now-canonical BIR PDF

---

## Week 6 wrap — 2026-06-01 → 2026-06-02

### Done — PDF rendering pipeline (dual-path)
- `render-on-template.ts` dispatches per template: AcroForm path fills
  by field name, coordinate path synthesises real AcroForm fields at
  the mapped positions. Downloaded PDFs stay editable.
- `templates/bir-2550m.ts`: 14-field coord map for BIR 2550M, derived
  from `pdftotext -bbox-layout` then offset by hand; tight field
  heights (`size + 2`) so the viewer's focus highlight doesn't bleed.

### Done — WYSIWYG editor (Phase 2)
- 2a: PDF pages pre-rendered as PNGs and used as backgrounds;
  absolutely-positioned transparent `<input>`s at the coord-map
  positions. Yellow hover / focus, red ring on required-empty.
- 2b: Layout mode + drag-to-reposition. Overrides stored on
  `form_submissions.field_overrides` and applied at PDF generation.
- 2c: Admins (ADMIN_EMAILS allow-list) can save the current layout
  back to the template as the new default for every user. Stored on
  `form_templates.field_mapping`.

### Done — Submissions UX (Edit + Delete)
- Pencil icon on each History row → opens fill page with saved values,
  overrides, and period restored; Save becomes PATCH-style.
- Trash icon → confirmation dialog → DELETE (also cleans up the
  stored PDF object).

### Done — Tax-amount auto-fill (L1 + L2)
- L1: typing into `gross_sales` cascades to `output_tax` (×12%) and
  `vat_payable` (output − input). Cascade also runs once on initial
  AI fill so derived cells aren't blank.
- L2: above the editor, a tabbed `<VATExtractor>`:
    Monthly summary — drop one Excel/PDF/image/Word/CSV/text doc,
                      AI extracts {gross_sales, output_tax,
                      input_tax, vat_payable, period}, Apply pushes
                      values through setVal so L1 still cascades.
    OR receipts    — drop multiple JPG/PNG/PDF receipts, each is
                      extracted sequentially with confidence, table
                      sums the VAT, Apply pushes the sum into
                      input_tax.

### Done — Archive sync on save (US-03)
- `<ArchiveSyncDialog>` after Save Draft: candidates = fields with
  data_source the user edited away from the AI's archive-sourced
  value. Each candidate routes to companies / company_people PATCH;
  user picks the subset to apply.

---

## Week 7 — 2026-06-02 → 2026-06-03

### Done — Reminders backbone
- `0010_reminders.sql`: unique (user_id, source_key) makes the
  compute idempotent; snooze + dismiss + email_sent_at live on the
  same row.
- `src/lib/reminders/compute.ts`: walks documents.expiry_date, builds
  a T-90/30/14/7 ladder per doc. Upserts with ignoreDuplicates so
  existing snooze / dismiss state survives re-runs.
- GET `/api/reminders` + POST `/api/reminders/recompute`.
- `/reminders` page: grouped by company, tone badges
  (past / soon / far), empty state with CTA.

### Done — Daily cron + Resend digest emails
- `src/lib/db/admin.ts`: service-role Supabase client.
- `src/lib/email/send-reminder.ts`: Resend REST POST + inline HTML
  template (no SDK dependency).
- `/api/cron/check-reminders`: walks every user, refreshes reminders,
  pulls due-and-untouched rows, sends one digest email per user,
  stamps `email_sent_at`. Auth via `CRON_SECRET`.
- `vercel.json`: daily at 08:00 UTC.

### Done — Snooze + dismiss actions
- PATCH / DELETE `/api/reminders/[id]`.
- `<ReminderActions>`: ··· menu with Snooze (1d / 7d / 30d) +
  Mark done. Uses the new `ui/dropdown-menu.tsx` (Radix wrapper).

### Done — Dashboard home
- `/dashboard` is the post-login landing (auth callback redirect
  updated). Greeting + two side-by-side widgets:
    Upcoming reminders — soonest 5 active rows.
    Recent activity   — last 7 days of submissions + uploads,
                        merged newest-first, capped at 6.
- Sidebar adds Dashboard at the top.

---

## Week 8 — 2026-06-03 → 2026-06-04

### Done — Mobile nav drawer (Phase 1)
- Extracted shared NavLinks. Sidebar (desktop) and MobileNav drawer
  (`md:hidden`) consume the same items.
- Topbar mounts a hamburger button on mobile; drawer closes on
  route change, locks body scroll while open.

### Done — Toast notifications (Phase 2)
- `ui/toaster.tsx`: module-scoped `toast()` emitter over Radix Toast
  primitives. Variants default / success / destructive.
- Mounted once in DashboardLayout.
- Wired into RecomputeRemindersButton + SubmissionActions
  (Generate / Download / Delete) — dropped their inline error
  `<span>`s and added explicit success states.

### Done — Per-page metadata + OG image (Phase 3)
- `app/layout.tsx`: title template ("%s · Quill"), OG + Twitter
  card defaults, metadataBase from `NEXT_PUBLIC_APP_URL`.
- Each top-level dashboard page exports its own metadata.
- `app/opengraph-image.tsx`: dynamic 1200×630 PNG via next/og.
- Fixed dead `/documents` sidebar link by adding a global
  all-documents list page with expiry tone badges.

### Done — Demo script (Phase 4)
- `docs/DEMO-SCRIPT.md`: a 60-second magic-moment reel + a 5-minute
  walkthrough, plus recording notes.

### Next
- Other 4 form templates (MAYORS_PERMIT_RENEWAL, BIR_0605, SEC_GIS,
  SSS_R3) — same recipe as BIR 2550M.
- Mobile responsiveness pass on /forms/fill (editor at scale).
- Real customer pilots (LJ Group accountant + 5-10 friend SMEs).
