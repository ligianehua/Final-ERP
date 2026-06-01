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

---

## 2026-06 — Document-to-PDF conversion

### LibreOffice headless (in-container)
- Customers upload templates in whatever format they have (XLS, DOC, DOCX,
  ODT, RTF, PPT, image scans, …). The server normalises everything to PDF
  before downstream fill/render code touches it.
- `soffice --headless --convert-to pdf` covers 30+ input formats with one
  binary. Free, battle-tested, no per-request API cost.
- Rejected alternatives:
  - **Gotenberg microservice** — equivalent capability, but adds an extra
    deployable service. Single-tenant ERP doesn't need the separation.
  - **CloudConvert / Aspose / etc.** — per-file pricing, customer data
    leaves our infrastructure.
  - **Pure-JS libraries (mammoth, xlsx → render)** — quality is uneven on
    complex government forms with merged cells and embedded shapes.
- **Deployment requirement**: production image must include
  `libreoffice-calc`, `libreoffice-writer`, `libreoffice-impress` (Draw is
  pulled in transitively). Vercel's serverless bundle limit makes a Docker
  target (Railway / Fly.io / self-hosted) the path of least resistance for
  this route — other routes can still ship to Vercel if we split later.

### pdf-lib for image-only inputs
- For JPG/PNG (typically photographed scans), we wrap the image in a
  single-page PDF directly with pdf-lib instead of routing through
  LibreOffice. Faster, no temp files, and pdf-lib is already a dependency.
