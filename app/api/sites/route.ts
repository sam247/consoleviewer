import { NextResponse } from "next/server";
import { listSites } from "@/lib/gsc";

export async function GET() {
  try {
    const sites = await listSites();
    return NextResponse.json(sites);
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "Failed to fetch sites" },
      { status: 500 }
    );
  }
}
