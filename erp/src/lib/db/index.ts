import "server-only";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set");
}

// One pooled connection per Node process. Supabase exposes a pgbouncer
// connection on port 6543 we use for app traffic; the direct 5432 URL
// (DATABASE_URL_DIRECT) is reserved for migrations.
const client = postgres(connectionString, {
  prepare: false, // pgbouncer transaction-mode requires this
  max: 10,
});

export const db = drizzle(client, { schema, logger: false });
export type DB = typeof db;
export { schema };
