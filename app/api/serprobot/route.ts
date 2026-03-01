import { NextRequest, NextResponse } from "next/server";
import { hasValidSession } from "@/lib/session";
import { serprobotFetch, hasSerprobotKey } from "@/lib/serprobot";

const ALLOWED_ACTIONS = ["list_projects", "project", "keyword", "credit"] as const;

export async function GET(request: NextRequest) {
  if (!(await hasValidSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!hasSerprobotKey()) {
    return NextResponse.json(
      { error: "SerpRobot API key not configured", configured: false },
      { status: 200 }
    );
  }
  const action = request.nextUrl.searchParams.get("action");
  if (!action || !ALLOWED_ACTIONS.includes(action as (typeof ALLOWED_ACTIONS)[number])) {
    return NextResponse.json(
      { error: `action must be one of: ${ALLOWED_ACTIONS.join(", ")}` },
      { status: 400 }
    );
  }
  const params: Record<string, string> = {};
  request.nextUrl.searchParams.forEach((value, key) => {
    if (key !== "action") params[key] = value;
  });
  try {
    const data = await serprobotFetch(action, params);
    return NextResponse.json({ ...(data as object), configured: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "SerpRobot request failed";
    return NextResponse.json({ error: message, configured: true }, { status: 502 });
  }
}
