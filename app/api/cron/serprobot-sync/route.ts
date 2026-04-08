import { NextRequest, NextResponse } from "next/server";
import { serprobotFetch, hasSerprobotKey } from "@/lib/serprobot";
import type { SerpRobotProject } from "@/types/serprobot";

/**
 * Weekly cron: hit SerpRobot to refresh keyword/rank data (server-side, no user session).
 * Configure in vercel.json crons (e.g. 0 0 * * 0 = Sundays at midnight).
 * Vercel sends Authorization: Bearer <CRON_SECRET>; validate it if CRON_SECRET is set.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!hasSerprobotKey()) {
    return NextResponse.json({ ok: true, message: "SerpRobot not configured; skip sync" });
  }

  try {
    const listRes = (await serprobotFetch("list_projects")) as { projects?: SerpRobotProject[]; data?: SerpRobotProject[] };
    const projects = listRes.projects ?? listRes.data ?? (Array.isArray(listRes) ? listRes : []);
    const first = Array.isArray(projects) ? projects[0] : null;
    const projectId = first && typeof first === "object" && "id" in first ? String((first as { id: unknown }).id) : null;
    if (!projectId) {
      return NextResponse.json({ ok: true, keywordsCount: 0, message: "No project" });
    }
    try {
      const kwRes = (await serprobotFetch("keyword", { project_id: projectId })) as { keywords?: unknown[]; data?: unknown[] };
      const raw = kwRes.keywords ?? kwRes.data ?? (Array.isArray(kwRes) ? kwRes : []);
      const count = Array.isArray(raw) ? raw.length : 0;
      return NextResponse.json({ ok: true, keywordsCount: count });
    } catch (kwErr) {
      const msg = kwErr instanceof Error ? kwErr.message : String(kwErr);
      // Some SerpRobot accounts expect keyword_id for this action; don't fail the
      // weekly sync when list_projects works but keyword listing is unsupported.
      if (msg.toLowerCase().includes("keyword_id")) {
        return NextResponse.json({
          ok: true,
          keywordsCount: 0,
          warning: "Keyword list action unavailable for this API account; skipping keyword sync.",
          detail: msg,
        });
      }
      throw kwErr;
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : "Sync failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
