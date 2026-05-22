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

### Next
- Day 2: Supabase project setup, env vars, client/server SDK init
- Install `@supabase/supabase-js` and `@supabase/ssr`
- Create `src/lib/db/supabase.ts` (browser + server clients)
- Test connection from an API route
