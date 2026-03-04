import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/session";
import { ensureTeamForUser } from "@/lib/team";
import { getAccessTokenForTeam } from "@/lib/gsc-tokens";

const GSC_BASE = "https://www.googleapis.com/webmasters/v3";

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const teamId = await ensureTeamForUser(userId);
  const token = await getAccessTokenForTeam(teamId);
  if (!token) {
    return NextResponse.json(
      { error: "GSC not connected", code: "gsc_not_connected" },
      { status: 404 }
    );
  }
  const res = await fetch(`${GSC_BASE}/sites`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });
  if (!res.ok) {
    if (res.status === 401) {
      return NextResponse.json(
        { error: "Invalid or expired GSC token", code: "token_expired" },
        { status: 401 }
      );
    }
    return NextResponse.json(
      { error: `GSC API error: ${res.status}` },
      { status: 502 }
    );
  }
  const data = (await res.json()) as { siteEntry?: { siteUrl?: string; permissionLevel?: string }[] };
  const entries = data.siteEntry ?? [];
  const sites = entries
    .filter((e): e is { siteUrl: string; permissionLevel: string } => Boolean(e?.siteUrl))
    .map((e) => ({ siteUrl: e.siteUrl, permissionLevel: e.permissionLevel ?? "" }));
  return NextResponse.json(sites);
}
