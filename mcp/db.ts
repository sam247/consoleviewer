import type { QueryResult, QueryResultRow } from "@neondatabase/serverless";
import { getPool } from "@/lib/db";

export async function readQuery<T extends QueryResultRow = QueryResultRow>(
  sql: string,
  params: unknown[] = []
): Promise<QueryResult<T>> {
  const trimmed = sql.trim().toLowerCase();
  if (!trimmed.startsWith("select") && !trimmed.startsWith("with")) {
    throw new Error("MCP readQuery only allows read-only SQL statements");
  }
  return getPool().query<T>(sql, params);
}
