import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/session";
import { ensureTeamForUser } from "@/lib/team";
import { getBingAccessTokenForTeam } from "@/lib/bing-tokens";

const BING_API_BASE = "https://ssl.bing.com/webmaster/api.svc/json";

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const teamId = await ensureTeamForUser(userId);
  const token = await getBingAccessTokenForTeam(teamId);
  if (!token) {
    return NextResponse.json(
      { error: "Bing not connected", code: "bing_not_connected" },
      { status: 404 }
    );
  }
  const res = await fetch(`${BING_API_BASE}/GetUserSites`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });
  if (!res.ok) {
    if (res.status === 401) {
      return NextResponse.json(
        { error: "Invalid or expired Bing token", code: "token_expired" },
        { status: 401 }
      );
    }
    return NextResponse.json(
      { error: `Bing API error: ${res.status}` },
      { status: 502 }
    );
  }
  const data = (await res.json()) as { d?: { Url?: string }[] };
  const raw = data.d ?? (Array.isArray(data) ? data : []);
  const sites = (Array.isArray(raw) ? raw : [])
    .map((entry) => {
      const url = typeof entry === "string" ? entry : (entry as { Url?: string })?.Url;
      return typeof url === "string" && url ? { siteUrl: url.replace(/\/+$/, "") || url, permissionLevel: "OWNER" } : null;
    })
    .filter((s): s is { siteUrl: string; permissionLevel: string } => s != null);
  return NextResponse.json(sites);
}
