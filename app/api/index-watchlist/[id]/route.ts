import { NextRequest, NextResponse } from "next/server";
import { hasValidSession, getOwnerUserId } from "@/lib/session";
import { getSupabaseServer } from "@/lib/supabase";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
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
      { error: "Watchlist not configured." },
      { status: 503 }
    );
  }
  const id = params.id?.trim();
  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  const { error } = await supabase
    .from("index_watchlist")
    .delete()
    .eq("id", id)
    .eq("owner_user_id", ownerId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return new NextResponse(null, { status: 204 });
}
