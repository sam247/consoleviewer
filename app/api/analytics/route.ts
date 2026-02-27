import { NextRequest, NextResponse } from "next/server";
import { querySearchAnalytics } from "@/lib/gsc";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const site = searchParams.get("site");
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");
  const dimensionsParam = searchParams.get("dimensions");

  if (!site || !startDate || !endDate) {
    return NextResponse.json(
      { error: "Missing site, startDate, or endDate" },
      { status: 400 }
    );
  }

  const dimensions = dimensionsParam ? dimensionsParam.split(",") : [];

  try {
    const data = await querySearchAnalytics(site, startDate, endDate, dimensions);
    return NextResponse.json(data);
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "Failed to fetch analytics" },
      { status: 500 }
    );
  }
}
