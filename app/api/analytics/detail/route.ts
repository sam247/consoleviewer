import { NextRequest, NextResponse } from "next/server";
import { getSiteDetail } from "@/lib/gsc";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const site = searchParams.get("site");
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");
  const priorStartDate = searchParams.get("priorStartDate");
  const priorEndDate = searchParams.get("priorEndDate");
  const brandedTermsParam = searchParams.get("brandedTerms");

  if (!site || !startDate || !endDate || !priorStartDate || !priorEndDate) {
    return NextResponse.json(
      {
        error:
          "Missing site, startDate, endDate, priorStartDate, or priorEndDate",
      },
      { status: 400 }
    );
  }

  let brandedTerms: string[] | undefined;
  if (brandedTermsParam) {
    try {
      const parsed = JSON.parse(brandedTermsParam);
      if (Array.isArray(parsed)) {
        brandedTerms = parsed.filter((t) => typeof t === "string") as string[];
      }
    } catch {
      // ignore invalid branded terms
    }
  }

  try {
    const data = await getSiteDetail(
      site,
      startDate,
      endDate,
      priorStartDate,
      priorEndDate,
      brandedTerms
    );
    return NextResponse.json(data);
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "Failed to fetch site detail" },
      { status: 500 }
    );
  }
}
