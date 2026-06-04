# Supabase Migrations

SQL schema for Quill. Run migrations **in numbered order**.

## How to apply (easiest method)

1. Open your Supabase project → **SQL Editor**
2. Click **New query**
3. Copy the contents of each migration file (starting with `0000_`)
4. Paste and click **Run**
5. Repeat for the next numbered file

Run them in this order:

| Order | File | What it creates |
|-------|------|-----------------|
| 1 | `0000_helpers.sql` | `handle_updated_at()` trigger function |
| 2 | `0001_companies.sql` | `companies` table + RLS policies |

## RLS (Row Level Security)

Every table has RLS enabled. Users can only read/write **their own** rows
(`auth.uid() = user_id`). This is enforced at the database level — even if
a bug in the API forgets to filter, Postgres blocks the access.

## Verifying it worked

After running, go to **Table Editor** → you should see the `companies` table.
Under **Authentication → Policies**, you should see 4 policies on `companies`.
