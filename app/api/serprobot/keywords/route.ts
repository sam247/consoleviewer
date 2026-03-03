import { NextRequest, NextResponse } from "next/server";
import { hasValidSession } from "@/lib/session";
import { serprobotFetch, hasSerprobotKey } from "@/lib/serprobot";
import type { SerpRobotProject, SerpRobotKeyword } from "@/types/serprobot";

/** Shape expected by TrackedKeywordsSection (mock-compatible). */
export type TrackedKeywordRow = {
  id?: string;
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
      const id = typeof k === "object" && k && "id" in k ? String((k as SerpRobotKeyword).id) : undefined;
      return {
        id,
        keyword: phrase,
        position,
        delta1d: 0,
        delta7d: 0,
        sparkData: [position],
      };
    });
    return NextResponse.json({ configured: true, keywords, projectId: pid });
  } catch (e) {
    const message = e instanceof Error ? e.message : "SerpRobot request failed";
    return NextResponse.json({
      configured: true,
      keywords: [],
      error: message,
    });
  }
}

async function resolveProjectId(projectId?: string | null): Promise<string | null> {
  if (!hasSerprobotKey()) return null;
  let pid: string | null = projectId?.trim() ?? null;
  if (!pid) {
    const listRes = (await serprobotFetch("list_projects")) as { projects?: SerpRobotProject[]; data?: SerpRobotProject[] };
    const projects = listRes.projects ?? listRes.data ?? (Array.isArray(listRes) ? listRes : []);
    const first = Array.isArray(projects) ? projects[0] : null;
    pid = first && typeof first === "object" && "id" in first ? String((first as { id: unknown }).id) : null;
  }
  return pid;
}

export async function POST(request: NextRequest) {
  if (!(await hasValidSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!hasSerprobotKey()) {
    return NextResponse.json({ error: "SerpRobot not configured" }, { status: 400 });
  }
  let body: { phrase?: string; projectId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const phrase = typeof body.phrase === "string" ? body.phrase.trim() : "";
  if (!phrase) {
    return NextResponse.json({ error: "phrase is required" }, { status: 400 });
  }
  const projectId = await resolveProjectId(body.projectId);
  if (!projectId) {
    return NextResponse.json({ error: "No SerpRobot project found" }, { status: 400 });
  }
  try {
    await serprobotFetch("add_keyword", { project_id: projectId, phrase });
    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "SerpRobot request failed";
    return NextResponse.json(
      { error: message, hint: "SerpRobot add_keyword may not be supported; check their API docs." },
      { status: 501 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  if (!(await hasValidSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!hasSerprobotKey()) {
    return NextResponse.json({ error: "SerpRobot not configured" }, { status: 400 });
  }
  const keywordId = request.nextUrl.searchParams.get("keywordId")?.trim();
  const phrase = request.nextUrl.searchParams.get("phrase")?.trim();
  if (!keywordId && !phrase) {
    return NextResponse.json({ error: "keywordId or phrase is required" }, { status: 400 });
  }
  try {
    if (keywordId) {
      await serprobotFetch("delete_keyword", { keyword_id: keywordId });
    } else if (phrase) {
      const projectId = await resolveProjectId(null);
      if (!projectId) return NextResponse.json({ error: "No SerpRobot project found" }, { status: 400 });
      await serprobotFetch("delete_keyword", { project_id: projectId, phrase });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "SerpRobot request failed";
    return NextResponse.json(
      { error: message, hint: "SerpRobot delete_keyword may not be supported; check their API docs." },
      { status: 501 }
    );
  }
}
