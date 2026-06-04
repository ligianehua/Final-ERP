import "dotenv/config";
import { defineConfig } from "drizzle-kit";

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
