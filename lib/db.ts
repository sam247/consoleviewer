import { Pool } from "@neondatabase/serverless";

const connectionString =
  process.env.NEON_DATABASE_URL || process.env.DATABASE_URL;

let pool: Pool | null = null;

export function getPool(): Pool {
  if (!connectionString) {
    throw new Error("NEON_DATABASE_URL is not set");
  }
  if (!pool) {
    pool = new Pool({ connectionString });
  }
  return pool;
}
