# Quill · Demo Script

Two versions: a 60-second "magic moment" reel and a 5-minute walkthrough.
Record both as MP4, save under `/demos/` so onboarding calls can pick the
right length.

---

## 60-Second Magic Moment

**Hook**: "Filipino business owners spend half a day every month on the
BIR 2550M. Watch this."

```
0:00–0:05  Wake the laptop. Show the / page (Quill landing).
           Voiceover: "Quill takes a photo of any government form and
           returns a filled, editable PDF in under a minute."

0:05–0:12  Sign in. Land on /dashboard.
           Voiceover: "I'm logged in as a small wholesale company.
           My archive already has my TIN, address, signatory."

0:12–0:25  Forms → click 2550M tile → pick "Quill Demo Trading Corp"
           → "Fill from archive".
           Voiceover: "I pick the form, pick the company. Two clicks."

0:25–0:38  Auto-fill panel up top:
             - drop a PDF sales summary (any month's bookkeeper export)
             - extracted gross_sales + input_tax pop in
             - L1 formulas cascade: output_tax + vat_payable
               appear in the editor.
           Voiceover: "I drop in last month's sales summary. Quill
           reads it, fills the four amounts that change every month,
           and runs the formulas. No typing."

0:38–0:48  Scroll into the WYSIWYG editor on the real BIR form.
           Quick value tweak. Toggle "Edit layout", drag one field
           1 cm right to show that's editable too. Toggle back.
           Voiceover: "Click any cell to edit. Drag any cell if your
           printer's misaligned. Done."

0:48–0:55  Save draft → Generate PDF → Download → open in Preview.
           Show that fields are still editable in the downloaded PDF.
           Voiceover: "Save. Generate. Download. Open it. Notice the
           fields still work — change anything before you print."

0:55–0:60  Cut back to the dashboard. Highlight reminders widget
           ("Mayor's Permit expires in 14 days"). Fade to logo.
           Voiceover: "Quill. Paperwork, signed off."
```

**One-liner takeaway**: "From a photo of a blank form to a printable PDF
in under 60 seconds — and Quill quietly tracks every certificate's
expiry so you never miss a renewal."

---

## 5-Minute Walkthrough

For first user calls. Builds trust by showing the entire app, not just
the wow shot.

### 0:00–0:30 · Intro & problem

- Show landing page, read the three feature cards out loud.
- Quote a problem statement: "Bookkeepers in Makati told us they spend
  4–6 hours every month on BIR 2550M alone, and miss permit renewals 1 in
  10 times. Quill kills both."

### 0:30–1:15 · Company Archive

- Land on `/dashboard`.
- Click **Companies** → walk through one archive:
  - Profile: TIN, SEC No, address, vat_status
  - People: owner, signatory
  - Documents: a BIR 2303, a Mayor's Permit
- Click into one document, hit the **Extract** spark, show AI extraction
  populating fields. Apply changes.

### 1:15–2:30 · The Forms flow

- Navigate to **Forms** → pick BIR 2550M.
- Pick a company, click **Fill from archive**.
- Show the Auto-fill panel:
  - **Monthly summary** tab: drop a PDF, watch the four amounts get
    extracted with confidence pill, click **Apply**.
  - Optionally show **OR receipts** tab: drop 3 receipts, sum
    accumulates, click **Apply ₱X to Input Tax**.
- Show the WYSIWYG editor:
  - Hover a cell to see hover tint, click to edit, save draft.
  - Toggle **Edit layout** and demonstrate drag-to-reposition.

### 2:30–3:15 · The PDF

- Save draft → land on `/submissions`.
- Click **Generate PDF**, wait, click **Download**.
- Open the PDF in Adobe Reader. Show:
  - Filled values at the right positions on the official form.
  - Click a field — it's editable. Change something, re-save.

### 3:15–4:00 · Edit + archive sync

- Back in the app, click the pencil on the submission, change the
  signatory's title, click **Update draft**.
- Archive-sync dialog: show the before → after, click
  **Update archive (1)**. Land on /submissions with a toast.
- Open the company → confirm the signatory's title was updated too.

### 4:00–4:40 · Reminders + dashboard

- Navigate to **Reminders**. Empty state → click **Recompute now**.
- Show 4 reminders appear (T-90 / T-30 / T-14 / T-7 of the Mayor's
  Permit expiry).
- Show the ··· menu — snooze 7 days, mark done.
- Back to `/dashboard`. Show the two widgets — soonest reminders + the
  recent activity timeline.

### 4:40–5:00 · Close

- Pull up the landing page in another tab.
- Recap: "Photo → filled PDF in 60s. Edit on the form. Reminders that
  email you. Built for the 5 highest-volume Philippine forms."
- Show the Quill 翎 wordmark. Pause.
- Pricing slide (when ready): "Beta is free. Paid tiers start at
  ₱500/month per company."

---

## Recording notes

- Resolution: 1920×1080, 60fps if your machine can.
- Audio: lavalier + a foam pop-filter if you're hot-mic'ing. Otherwise
  redub voiceover in post — easier to keep timing tight.
- Cursor: enable "highlight cursor" in macOS accessibility or use
  Mouseposé so the viewer follows along.
- Window chrome: use a single Chrome profile with no extension icons.
- Demo data: keep `Quill Demo Trading Corp` populated with realistic
  but obviously-fake values (TIN 123-456-789-000, etc.) so we never
  leak a real taxpayer's identifiers.
