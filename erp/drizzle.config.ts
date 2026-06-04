import { config as loadEnv } from "dotenv";
import { defineConfig } from "drizzle-kit";

// Next.js convention is .env.local for local-only secrets; vanilla
// dotenv only reads .env. Load both so `pnpm db:migrate` and friends
// pick up the same values Next.js does.
loadEnv({ path: ".env.local", quiet: true });
loadEnv({ quiet: true }); // falls back to .env

const url = process.env.DATABASE_URL_DIRECT ?? process.env.DATABASE_URL;
if (!url) {
  throw new Error(
    "Missing DATABASE_URL_DIRECT (preferred) or DATABASE_URL in env",
  );
}

export default defineConfig({
  schema: "./src/lib/db/schema/index.ts",
  out: "./supabase/migrations",
  dialect: "postgresql",
  dbCredentials: { url },
  verbose: true,
  strict: true,
  // Match Supabase's migration naming so generated SQL is human-sortable
  migrations: { prefix: "timestamp" },
});
