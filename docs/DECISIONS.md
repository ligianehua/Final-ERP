# Quill · Architecture Decisions

> Why we chose each tool/pattern. Add a new entry for every significant decision.

---

## 2025-Q2 — Initial Stack

### Next.js 15 (App Router)
- Full-stack in one repo: API routes + frontend
- RSC reduces client bundle for simple pages
- Vercel deploy is zero-config

### Supabase
- Auth (email OTP) out of the box
- Postgres RLS handles multi-tenant security per-row
- Storage bucket for form images and PDFs
- Free tier sufficient for MVP demo phase

### Claude API (@anthropic-ai/sdk)
- Best semantic reasoning for Philippine government form field mapping
- Haiku for cheap extraction tasks, Sonnet for complex mapping
- Prompt caching reduces cost on repeated archive context

### Google Cloud Vision OCR
- Superior accuracy on government form scans vs. open-source alternatives
- Bounding-box output needed for field localization
- $300 free credit covers entire MVP phase

### pdf-lib
- Pure JS, runs in Node API routes (no native binary)
- Supports coordinate-based field filling on existing PDF templates

### Tailwind + shadcn/ui (Stone theme)
- Stone palette matches Quill's editorial, ink-on-paper brand identity
- Component primitives owned in-repo (no version lock-in)

### Zustand
- Minimal boilerplate for form wizard state
- RSC-compatible (client-only where needed)

### Resend
- Simple email API, generous free tier
- Perfect for transactional reminder emails

### pnpm
- Faster installs, strict dependency isolation
- Workspace-compatible for future monorepo if needed
