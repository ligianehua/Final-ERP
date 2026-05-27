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
