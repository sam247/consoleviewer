import { NextRequest, NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/session";
import { getTeamIdForUser } from "@/lib/team";
import { getOverviewMetricsFromDb } from "@/lib/overview-db";
import { getOverviewMetrics } from "@/lib/gsc";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");
  const priorStartDate = searchParams.get("priorStartDate");
  const priorEndDate = searchParams.get("priorEndDate");

  if (!startDate || !endDate || !priorStartDate || !priorEndDate) {
    return NextResponse.json(
      { error: "Missing startDate, endDate, priorStartDate, or priorEndDate" },
      { status: 400 }
    );
  }

  try {
    const userId = await getSessionUserId();
    const teamId = userId ? await getTeamIdForUser(userId) : null;

    if (teamId) {
      const data = await getOverviewMetricsFromDb({
        teamId,
        startDate,
        endDate,
        priorStartDate,
        priorEndDate,
      });
      return NextResponse.json(data, {
        headers: { "Cache-Control": "no-store" },
      });
    }

    const data = await getOverviewMetrics(
      startDate,
      endDate,
      priorStartDate,
      priorEndDate
    );
    return NextResponse.json(data, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "Failed to fetch overview metrics" },
      { status: 500 }
    );
  }
}
