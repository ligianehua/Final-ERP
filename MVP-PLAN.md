# Quill Permit · MVP Plan

> The 8-week implementation bible. Read this whenever you start a new day or feel lost.
>
> **Status**: Active · **Version**: 1.0 · **Owner**: Li Jianhua · **Started**: 2025-Q2

---

## TL;DR — Read this if nothing else

You are building **Quill Permit**, the AI permit advisor for Philippine SMEs. The MVP must, in 8 weeks, demonstrate this magic moment:

> A Filipino business owner snaps a photo of a BIR Form 2550M, and within 60 seconds, the form is filled with their company's data and ready to print as a PDF.

That single flow — photo → AI fill → printable PDF — is what every line of code in this repo must serve.

**Not goals (Phase 2+):**
- Multi-tenant SaaS
- Payment / subscription
- Mobile native app (PWA is enough)
- Voice input
- Full bilingual UI

**Phase 1 audience**: Demo-only. LJ Group's accountant + 5-10 friend SMEs. No paying customers in Week 8.

---

## 1. Product Specification

### 1.1 Core User Stories

| ID | Story | Week |
|----|-------|------|
| US-01 | Owner creates and manages a Company Archive (multi-company support, 5 standard folders) | 2 |
| US-02 | Owner uploads a government form photo → AI identifies form type → fills fields from archive | 4-5 |
| US-03 | When fields are missing, system guides user to fill them; data auto-syncs back to archive | 6 |
| US-04 | All certificates auto-tracked for expiry, with 90/30/14/7-day reminders | 7 |
| US-05 | All submissions saved to history; user can search and "copy from previous filing" | 7 |

### 1.2 Company Archive Structure

Each company in the archive has 5 standard folders:

1. **Company Info** — name, TIN, SEC No, DTI No, addresses, phone, VAT status
2. **People** — owners, officers, employees (full_name, TIN, SSS, PhilHealth, Pag-IBIG)
3. **Financial Accounts** — bank accounts, BIR e-Tax accounts
4. **Documents** — uploaded certificates (Mayor's Permit, BIR 2303, SEC Certs)
5. **Employees** — employment records, salary, benefits

### 1.3 MVP Form Coverage (Priority Order)

The 5 forms supported in v1:

| Priority | Form Code | Form Name | Agency | Frequency |
|----------|-----------|-----------|--------|-----------|
| **1 ⭐** | BIR_2550M | Monthly VAT Declaration | BIR | Monthly |
| 2 | MAYORS_PERMIT_RENEWAL | Mayor's Permit Renewal | LGU | Annual |
| 3 | BIR_0605 | Payment Form | BIR | Per payment |
| 4 | SEC_GIS | General Information Sheet | SEC | Annual |
| 5 | SSS_R3 | Contribution Collection List | SSS | Monthly |

Start with **BIR 2550M**. Once that pipeline works end-to-end, others are essentially "copy the pattern + adjust Prompt + adjust PDF coordinates."

### 1.4 Language Strategy

**Decided** (Week 1 commitment, do not change without re-discussion):

- **Default UI language**: English (Philippine market standard)
- **Toggle to Chinese**: Available in user settings
- **Tooltips**: Bilingual (always show both)
- **Government form field labels**: Keep official English terms (e.g., "BIR Form 2550M" never translated)

---

## 2. Technical Architecture

### 2.1 Stack (Locked, do not change)

```
┌─────────────────────────────────────────────┐
│  Frontend: Next.js 15 (App Router) + TS     │
│  Styling:  Tailwind + shadcn/ui (Stone)     │
│  State:    Zustand                          │
│  Auth:     Supabase Auth (Email OTP)        │
│  DB:       Supabase Postgres                │
│  Storage:  Supabase Storage                 │
│  AI:       Claude API (@anthropic-ai/sdk)   │
│  OCR:      Google Cloud Vision API          │
│  PDF:      pdf-lib                          │
│  Email:    Resend                           │
│  Deploy:   Vercel (frontend) + Supabase     │
│  Package:  pnpm                             │
└─────────────────────────────────────────────┘
```

**Why each:** See `/docs/DECISIONS.md`.

### 2.2 Data Flow — The Critical Pipeline

```
1. User uploads government form photo
   ↓
2. Image → Supabase Storage (private bucket)
   ↓
3. API Route /api/forms/recognize:
   a. Google Vision OCR → text + bounding boxes
   b. Claude (Prompt #1) → identify form type + confidence
   ↓
4. API Route /api/forms/fill:
   a. Load company archive (companies + people + documents)
   b. Claude (Prompt #2) → map fields semantically + suggest values
   c. Return JSON: { fields: [{label, value, confidence}], missing: [...] }
   ↓
5. UI: User reviews/edits each field → confirms
   ↓
6. API Route /api/forms/generate-pdf:
   a. pdf-lib loads template
   b. Fill fields at known coordinates
   c. Save filled PDF to Supabase Storage
   d. Create record in form_submissions table
   ↓
7. UI: Download / print PDF
```

### 2.3 Database Schema (6 tables)

Full SQL in `/supabase/migrations/`. Summary:

```sql
companies              -- Multi-company per user
company_people         -- Owners, officers, employees per company
documents              -- Uploaded certificates (PDF/images)
form_templates         -- 5 government forms, with field schema
form_submissions       -- History of all filled forms
reminders              -- Renewal tracking
```

### 2.4 API Routes

```
POST   /api/companies                    Create company
GET    /api/companies                    List user's companies
GET    /api/companies/[id]               Get one company (with people, docs)
PATCH  /api/companies/[id]               Update company
DELETE /api/companies/[id]               Delete company

POST   /api/companies/[id]/people        Add person
PATCH  /api/people/[id]                  Update person

POST   /api/documents/upload             Upload + auto-extract metadata
GET    /api/documents                    List documents

POST   /api/forms/recognize              Image → form type
POST   /api/forms/fill                   Form type + archive → field values
POST   /api/forms/generate-pdf           Fill PDF template → return URL

GET    /api/submissions                  History of filed forms
GET    /api/reminders                    Upcoming renewal alerts
POST   /api/reminders/[id]/snooze        Snooze a reminder
```

---

## 3. AI Prompt Strategy

All prompts versioned in `/src/lib/ai/prompts.ts` and documented in `/docs/PROMPTS.md`.

### 3.1 Prompt #1 — Form Type Classification

**Purpose**: Given OCR text from a scanned form, identify which of the 5 supported forms it is.

**Model**: GPT-4o-mini (classification is cheap; ~$0.001/call)

**Output schema**:
```json
{
  "form_code": "BIR_2550M",
  "form_name": "Monthly VAT Declaration",
  "agency": "BIR",
  "confidence": 0.95,
  "reasoning": "Found header text '2550M' and 'Monthly VAT'..."
}
```

**Fallback**: If confidence < 0.7, return `UNKNOWN` and let user pick manually.

### 3.2 Prompt #2 — Field Semantic Mapping

**Purpose**: Map each detected field in the form to data from the user's company archive.

**Model**: Claude Sonnet 4.5 (complex reasoning; ~$0.025/call)

**Output schema**:
```json
{
  "fields": [
    {
      "field_label": "Taxpayer Name",
      "semantic_type": "company_name",
      "value": "ABC Trading Corporation",
      "source": "companies.name",
      "confidence": 0.98
    }
  ],
  "missing_fields": [
    {
      "field_label": "Authorized Representative TIN",
      "reason": "No representative TIN in company profile",
      "suggestion": "Add representative info under People"
    }
  ]
}
```

**Hard rule**: Never invent data. If unsure → return null, add to `missing_fields`.

### 3.3 Prompt #3 — Document Metadata Extraction

**Purpose**: When user uploads a certificate (e.g., Mayor's Permit), extract key fields automatically.

**Model**: Claude Haiku 4.5 (simple extraction; ~$0.005/call)

**Output schema**:
```json
{
  "document_type": "MAYORS_PERMIT",
  "document_number": "QC-2024-12345",
  "issued_date": "2024-01-15",
  "expiry_date": "2025-01-15",
  "issuing_authority": "Quezon City Government",
  "subject_entity": {
    "name": "ABC Trading Corporation",
    "tin": "123-456-789-000"
  }
}
```

### 3.4 Cost per User per Form

Estimated cost for one complete form workflow (photo → PDF):
- OCR (Google Vision): $0.0015
- Prompt #1: $0.001
- Prompt #2: $0.025
- Prompt #3 (if cert upload): $0.005
- **Total**: ~$0.031 ≈ ₱1.70

At 1,000 forms/day in demo, cost is ~₱1,700/day — negligible.

---

## 4. 8-Week Build Plan

Each week ends with a **demo to self** (record a 60-second screen capture, save to `/demos/week-N.mov`).

### Week 1 · Foundation (Mon-Sun)

**Goal**: Project skeleton + Supabase auth working + first DB table.

| Day | Task |
|-----|------|
| 1 | Project bootstrap (Next.js, shadcn, folders, docs, landing page) |
| 2 | Supabase project setup, env vars, client/server SDK init |
| 3 | Auth flow: email OTP signup/login pages |
| 4 | `companies` table schema + RLS policies |
| 5 | Companies CRUD API + minimal UI (list + create) |
| 6 | Vercel deploy, custom domain setup |
| 7 | Test from phone, polish, commit. **Week 1 Demo**. |

### Week 2 · Company Archive

**Goal**: User can store all their company data in one place.

| Day | Task |
|-----|------|
| 1-2 | `company_people` table + CRUD UI |
| 3-4 | `documents` table + Supabase Storage upload |
| 5 | 5 standard folders UI in document manager |
| 6 | Document list / search / filter |
| 7 | UX polish. **Week 2 Demo** (upload a real Mayor's Permit). |

### Week 3 · Document AI Extraction

**Goal**: Upload a certificate → AI reads it → autofills metadata.

| Day | Task |
|-----|------|
| 1-2 | Google Vision API integration (OCR pipeline) |
| 3-4 | Write Prompt #3, test on 10 real Philippine docs |
| 5 | `/api/documents/upload` integrates OCR + Claude |
| 6-7 | UI: extraction preview, user confirmation. **Week 3 Demo**. |

### Week 4 · Form Recognition (Core #1)

**Goal**: Snap a form photo → AI says "this is BIR 2550M."

| Day | Task |
|-----|------|
| 1-2 | Collect 10 high-res scans of the 5 priority forms |
| 3 | Write Prompt #1, test classification accuracy |
| 4-5 | `/api/forms/recognize` API + UI camera button |
| 6-7 | Recognition preview screen. **Week 4 Demo**. |

### Week 5 · Field Mapping (Core #2 — The Hardest Week)

**Goal**: Form's blank fields auto-populated from archive.

| Day | Task |
|-----|------|
| 1-2 | Define `form_templates` schema; manually input field_schema for BIR 2550M |
| 3-4 | Write Prompt #2 (most critical prompt), iterate on accuracy |
| 5-6 | `/api/forms/fill` complete pipeline |
| 7 | Field review UI (editable, with confidence badges). **Week 5 Demo**. |

### Week 6 · PDF Generation + Missing Field Flow

**Goal**: Final printable PDF + smooth UX for missing data.

| Day | Task |
|-----|------|
| 1-2 | pdf-lib integration; coordinate-map 5 PDF templates |
| 3 | Missing-field guided form UI |
| 4-5 | PDF preview + download |
| 6 | Backfill confirmed data to company archive |
| 7 | **Week 6 Demo**: Full photo → PDF flow works end-to-end. 🎉 |

### Week 7 · Reminders + History

**Goal**: Track expiry, notify, archive submissions.

| Day | Task |
|-----|------|
| 1-2 | `reminders` table + cron logic |
| 3 | Resend email integration for reminders |
| 4 | Supabase Cron (or Vercel Cron) daily check |
| 5-6 | `form_submissions` history UI |
| 7 | Dashboard home: upcoming reminders + recent activity. **Week 7 Demo**. |

### Week 8 · Polish + Demo Video

**Goal**: Production-grade UX + a 5-min demo video for first user calls.

| Day | Task |
|-----|------|
| 1-3 | UI/UX polish (loading states, animations, error messages) |
| 4 | Mobile responsiveness check |
| 5 | Record 5-min demo video (script in `/docs/DEMO-SCRIPT.md`) |
| 6 | Landing page on `getquill.ai` (whitepaper-style) |
| 7 | Internal demo + feedback + bug fixes. **MVP COMPLETE**. |

---

## 5. Working Style with Claude Code

### 5.1 Daily Loop

```
Morning (15 min):
  1. Open Claude Code
  2. Read /docs/CHANGELOG.md → what was done yesterday
  3. Pick today's task from /docs/MVP-PLAN.md
  4. Write a "Today's Task" prompt referencing this MVP-PLAN.md

During (3-4 hr):
  5. Work in small steps; verify each before moving on
  6. Each task completion = one git commit

End of day (10 min):
  7. Update /docs/CHANGELOG.md (what was done, what's next)
  8. Git push to GitHub
```

### 5.2 When Stuck

- Describe the error precisely. Do not say "it doesn't work."
- Ask Claude Code to "explain this code" instead of "fix it" — understanding > patching
- If a task feels too big, split it; re-prompt with the smaller piece
- After 3 failed attempts at the same problem → step away, take a walk

### 5.3 Hard Rules (No Exceptions)

- ✅ Every file is TypeScript
- ✅ Every task ends with a `git commit`
- ✅ Every new env var added to `.env.local.example`
- ✅ Every decision logged in `/docs/DECISIONS.md`
- ❌ No ESLint or Prettier setup until Week 6+
- ❌ No premature optimization
- ❌ No "let me just refactor this real quick"

---

## 6. Budget & Constraints

### 6.1 Money

| Item | Cost (8 weeks) |
|------|----------------|
| Vercel | $0 (free tier sufficient for demo) |
| Supabase | $0 (free tier sufficient) |
| Claude API | ~$100 (dev + testing) |
| Google Vision | ~$60 (covered by $300 free credit) |
| Resend | $0 (free tier) |
| Domain (getquill.ai 2yr + quill.ph 1yr) | ~$200 |
| Claude Code subscription | ~$400 (Pro/Max plan, 2 months) |
| **Total cash out** | **~$760 ≈ ₱43,000** |

### 6.2 Time

- Daily: 3-4 focused hours
- Weekly: 5-6 days/week
- Total: 200-250 hours over 8 weeks

If you can only commit 2 hr/day, extend timeline to 12 weeks.

---

## 7. Risk Register

| Risk | Probability | Mitigation |
|------|-------------|------------|
| Google Vision OCR struggles with PH forms | Medium-High | Test 5 sample forms in Week 1; fallback to EasyOCR if needed |
| Prompt #2 (field mapping) accuracy < 80% | Medium | Allocate Week 5 entirely; expect 2-3 prompt iterations |
| PDF field coordinates hard to map | High | Build a visual coordinate-mapper tool in Week 6 day 1 |
| 8 weeks not enough | Medium | Drop forms 4-5 (SEC GIS, SSS R-3); ship with 3 forms |
| Solo founder time constraints | Medium | Each week's tasks are atomic; can pause anytime |
| Cost exceeds budget | Low | Monthly budget alerts on Anthropic + GCP |

---

## 8. Definition of Done — Week 8

The MVP is "done" when **all** of these are true:

- [ ] User can sign up with email OTP and log in
- [ ] User can create at least 3 companies
- [ ] User can upload at least 5 documents per company
- [ ] User can snap a photo of BIR 2550M and get a filled PDF in under 90 seconds
- [ ] At least 3 other forms work (Mayor's Permit, BIR 0605, SEC GIS minimum)
- [ ] Reminders fire by email 30 days before any document expiry
- [ ] History page shows all past submissions, searchable
- [ ] App works on iPhone Safari and Android Chrome (PWA)
- [ ] Deployed at `demo.getquill.ai`
- [ ] 5-minute demo video recorded
- [ ] At least 3 friend-SMEs have tried it and given feedback

---

## 9. References

| Document | Purpose |
|----------|---------|
| `/docs/DECISIONS.md` | Why we chose each tool/pattern |
| `/docs/CHANGELOG.md` | Daily progress log |
| `/docs/PROMPTS.md` | All AI prompts, versioned |
| `/docs/DEMO-SCRIPT.md` | Week 8 demo video script |
| `/supabase/migrations/` | All DB schema |
| `/public/form-templates/` | 5 government PDF templates |

External:
- Brand identity: `Quill-VI品牌系统-v2.html` (in root)
- Full master plan (Phase 2+): `Quill-主合集文档.docx`

---

## 10. North Star

When in doubt, ask:

> **Will this help a Filipino business owner snap a photo and get a filled PDF in 90 seconds?**

If yes → ship it.
If no → cut it.

That's the whole MVP.

---

*Last updated: Week 1, Day 0. Update this doc at the end of each week.*

*Paperwork, signed off. / 翰墨自此，非负担。*

— **Quill · 翎**
