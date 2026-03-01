import { NextRequest, NextResponse } from "next/server";
import { hasValidSession, getOwnerUserId } from "@/lib/session";
import { getSupabaseServer } from "@/lib/supabase";

export async function GET(request: NextRequest) {
  if (!(await hasValidSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const ownerId = await getOwnerUserId();
  if (!ownerId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const supabase = getSupabaseServer();
  if (!supabase) {
    return NextResponse.json({ watchlist: [] }, { status: 200 });
  }
  const propertyId = request.nextUrl.searchParams.get("propertyId");
  if (!propertyId?.trim()) {
    return NextResponse.json({ error: "propertyId required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("index_watchlist")
    .select("id, url, label, created_at")
    .eq("owner_user_id", ownerId)
    .eq("property_id", propertyId)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ watchlist: data ?? [] });
}

export async function POST(request: NextRequest) {
  if (!(await hasValidSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const ownerId = await getOwnerUserId();
  if (!ownerId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const supabase = getSupabaseServer();
  if (!supabase) {
    return NextResponse.json(
      { error: "Watchlist not configured. Set Supabase env vars." },
      { status: 503 }
    );
  }
  let body: { propertyId: string; url: string; label?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const { propertyId, url, label } = body;
  if (!propertyId?.trim() || !url?.trim()) {
    return NextResponse.json({ error: "propertyId and url required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("index_watchlist")
    .insert({
      owner_user_id: ownerId,
      property_id: propertyId.trim(),
      url: url.trim(),
      label: label?.trim() || null,
    })
    .select("id, url, label, created_at")
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "URL already in watchlist" }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data);
}
