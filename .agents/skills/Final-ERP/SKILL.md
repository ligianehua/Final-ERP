```markdown
# Final-ERP Development Patterns

> Auto-generated skill from repository analysis

## Overview
This skill teaches you the core development patterns, coding conventions, and typical workflows of the Final-ERP repository. The project is a Next.js application written in TypeScript, with a focus on modular code, clear commit conventions, and a structured approach to database migrations, API development, and configuration management.

## Coding Conventions

### File Naming
- Use **camelCase** for file and directory names.
  - Example: `userProfile.tsx`, `orderDetails.ts`

### Import Style
- Use **alias imports** for internal modules.
  - Example:
    ```typescript
    import { validateOrder } from '@/lib/validations/orderValidation';
    import DashboardLayout from '@/components/dashboardLayout';
    ```

### Export Style
- Use **default exports** for components and modules.
  - Example:
    ```typescript
    export default function UserProfile() {
      // component code
    }
    ```

### Commit Messages
- Follow **Conventional Commits** with prefixes: `feat`, `chore`, `fix`
  - Example: `feat: add user role management to dashboard`

## Workflows

### Add Database Table and Migrations
**Trigger:** When introducing a new domain entity or table in the database  
**Command:** `/new-table`

1. Create a new migration SQL file in `supabase/migrations/` (e.g., `000X_entity.sql`)
2. Optionally update or add helper SQL files (e.g., triggers, functions)
3. Update `supabase/README.md` with migration instructions

**Example:**
```sql
-- supabase/migrations/0004_customer.sql
CREATE TABLE customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text UNIQUE NOT NULL
);
```
```markdown
# supabase/README.md

## Running Migrations
psql < supabase/migrations/0004_customer.sql
```

---

### Implement API Endpoint with UI and Validation
**Trigger:** When adding CRUD or feature functionality exposed via API and surfaced in the frontend  
**Command:** `/new-endpoint`

1. Create or update API route file(s) in `src/app/api/...`
2. Add or update UI page(s) and components in `src/app/(dashboard)/...` and `src/components/...`
3. Add or update validation schema in `src/lib/validations/...`
4. Update shared types if needed
5. Update `docs/CHANGELOG.md`

**Example:**
```typescript
// src/app/api/customers/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { customerSchema } from '@/lib/validations/customer';

export default async function handler(req: NextRequest) {
  const data = await req.json();
  const parsed = customerSchema.safeParse(data);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }
  // ...handle creation
}
```
```typescript
// src/lib/validations/customer.ts
import * as z from 'zod';

export const customerSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
});
```

---

### Update Dependency or Build Tool Configuration
**Trigger:** When fixing or relaxing package manager/build tool policies to allow builds or installs  
**Command:** `/fix-build-config`

1. Update `package.json` with new or changed settings
2. Update `pnpm-workspace.yaml` or add `.npmrc` as needed
3. Commit minimal changes to configuration files

**Example:**
```json
// package.json
{
  "dependencies": {
    "next": "^13.4.0",
    "zod": "^3.20.0"
  }
}
```
```yaml
# pnpm-workspace.yaml
packages:
  - 'apps/*'
  - 'packages/*'
```

## Testing Patterns

- Test files use the pattern `*.test.*` (e.g., `user.test.ts`)
- The specific testing framework is not specified, but test files are colocated with implementation or in relevant directories.
- Example:
  ```typescript
  // user.test.ts
  import { validateUser } from '@/lib/validations/user';

  test('valid user', () => {
    expect(validateUser({ name: 'Alice', email: 'a@b.com' })).toBe(true);
  });
  ```

## Commands

| Command         | Purpose                                                      |
|-----------------|-------------------------------------------------------------|
| /new-table      | Start a new database table and migration workflow            |
| /new-endpoint   | Scaffold a new API endpoint with UI and validation           |
| /fix-build-config | Update dependency or build tool configuration               |
```
