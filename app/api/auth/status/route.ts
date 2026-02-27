import { NextResponse } from "next/server";
import { getAccessToken } from "@/lib/google-auth";

export async function GET() {
  const token = await getAccessToken();
  return NextResponse.json({ gscConnected: Boolean(token) });
}
