---
name: add-database-table-and-migrations
description: Workflow command scaffold for add-database-table-and-migrations in Final-ERP.
allowed_tools: ["Bash", "Read", "Write", "Grep", "Glob"]
---

# /add-database-table-and-migrations

Use this workflow when working on **add-database-table-and-migrations** in `Final-ERP`.

## Goal

Adds a new database table to the Supabase schema, including migration SQL and documentation.

## Common Files

- `supabase/migrations/*.sql`
- `supabase/README.md`

## Suggested Sequence

1. Understand the current state and failure mode before editing.
2. Make the smallest coherent change that satisfies the workflow goal.
3. Run the most relevant verification for touched files.
4. Summarize what changed and what still needs review.

## Typical Commit Signals

- Create a new migration SQL file in supabase/migrations/ (e.g., 000X_entity.sql)
- Optionally update or add helper SQL files (e.g., triggers, functions)
- Update supabase/README.md with migration instructions

## Notes

- Treat this as a scaffold, not a hard-coded script.
- Update the command if the workflow evolves materially.