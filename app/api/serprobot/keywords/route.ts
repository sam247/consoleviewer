import { NextRequest, NextResponse } from "next/server";
import { hasValidSession } from "@/lib/session";
import { serprobotFetch, hasSerprobotKey } from "@/lib/serprobot";
import type { SerpRobotProject, SerpRobotKeyword } from "@/types/serprobot";

/** Shape expected by TrackedKeywordsSection (mock-compatible). */
export type TrackedKeywordRow = {
  keyword: string;
  position: number;
  delta1d: number;
  delta7d: number;
  sparkData: number[];
};

export async function GET(request: NextRequest) {
  if (!(await hasValidSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!hasSerprobotKey()) {
    return NextResponse.json({
      configured: false,
      keywords: [],
      message: "Connect SerpRobot in Settings to track keywords.",
    });
  }
  const projectId = request.nextUrl.searchParams.get("projectId")?.trim();

  try {
    let pid = projectId;
    if (!pid) {
      const listRes = (await serprobotFetch("list_projects")) as { projects?: SerpRobotProject[]; data?: SerpRobotProject[] };
      const projects = listRes.projects ?? listRes.data ?? (Array.isArray(listRes) ? listRes : []);
      const first = Array.isArray(projects) ? projects[0] : null;
      pid = first && typeof first === "object" && "id" in first ? String((first as { id: unknown }).id) : undefined;
    }
    if (!pid) {
      return NextResponse.json({
        configured: true,
        keywords: [],
        message: "No SerpRobot project found. Create a project in SerpRobot or pass projectId.",
      });
    }
    const kwRes = (await serprobotFetch("keyword", { project_id: pid })) as {
      keywords?: SerpRobotKeyword[];
      data?: SerpRobotKeyword[];
    };
    const raw = kwRes.keywords ?? kwRes.data ?? (Array.isArray(kwRes) ? kwRes : []);
    const list: SerpRobotKeyword[] = Array.isArray(raw) ? raw : [];
    const keywords: TrackedKeywordRow[] = list.map((k) => {
      const phrase = typeof k === "object" && k && "phrase" in k ? String(k.phrase) : String(k);
      const position = typeof k === "object" && k && "position" in k && typeof (k as SerpRobotKeyword).position === "number"
        ? (k as SerpRobotKeyword).position!
        : 0;
      return {
        keyword: phrase,
        position,
        delta1d: 0,
        delta7d: 0,
        sparkData: [position],
      };
    });
    return NextResponse.json({ configured: true, keywords });
  } catch (e) {
    const message = e instanceof Error ? e.message : "SerpRobot request failed";
    return NextResponse.json({
      configured: true,
      keywords: [],
      error: message,
    });
  }
}
