import { NextRequest, NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { runNightlyEtl } from "@/lib/etl/nightly";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const pool = getPool();
    await pool.query("SELECT 1");
  } catch (dbErr) {
    const msg = dbErr instanceof Error ? dbErr.message : String(dbErr);
    return NextResponse.json(
      { ok: false, error: "Database unreachable", dbError: msg },
      { status: 500 }
    );
  }

  try {
    const { searchParams } = request.nextUrl;
    const modeParam = searchParams.get("mode");
    const daysParam = searchParams.get("days");
    const advanceParam = searchParams.get("advance");
    const cursorParam = searchParams.get("cursor");
    const limitParam = searchParams.get("limit");
    const result = await runNightlyEtl({
      mode: modeParam === "backfill" ? "backfill" : "nightly",
      backfillDays: daysParam ? Number(daysParam) : undefined,
      advanceWatermark: advanceParam === "0" ? false : undefined,
      cursor: cursorParam ?? undefined,
      propertyLimit: limitParam ? Number(limitParam) : undefined,
    });
    // Per-property failures are reported as partialFailure; still HTTP 200 so batch
    // schedulers (e.g. GitHub Actions) continue through all property chunks.
    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "ETL failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
