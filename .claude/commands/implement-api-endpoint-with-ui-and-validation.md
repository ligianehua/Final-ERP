---
name: implement-api-endpoint-with-ui-and-validation
description: Workflow command scaffold for implement-api-endpoint-with-ui-and-validation in Final-ERP.
allowed_tools: ["Bash", "Read", "Write", "Grep", "Glob"]
---

# /implement-api-endpoint-with-ui-and-validation

Use this workflow when working on **implement-api-endpoint-with-ui-and-validation** in `Final-ERP`.

## Goal

Implements a new API endpoint, adds corresponding UI pages/components, and sets up validation logic.

## Common Files

- `src/app/api/**/*.ts`
- `src/app/(dashboard)/**/*.tsx`
- `src/components/**/*.tsx`
- `src/lib/validations/*.ts`
- `docs/CHANGELOG.md`

## Suggested Sequence

1. Understand the current state and failure mode before editing.
2. Make the smallest coherent change that satisfies the workflow goal.
3. Run the most relevant verification for touched files.
4. Summarize what changed and what still needs review.

## Typical Commit Signals

- Create or update API route file(s) in src/app/api/...
- Add or update UI page(s) and components in src/app/(dashboard)/... and src/components/...
- Add or update validation schema in src/lib/validations/...
- Update shared types if needed
- Update docs/CHANGELOG.md

## Notes

- Treat this as a scaffold, not a hard-coded script.
- Update the command if the workflow evolves materially.