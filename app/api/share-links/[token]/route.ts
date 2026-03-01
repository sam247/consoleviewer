import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { getSupabaseServer } from "@/lib/supabase";

export async function GET(
  _request: NextRequest,
  { params }: { params: { token: string } }
) {
  const token = params.token?.trim();
  if (!token) {
    return NextResponse.json({ error: "Missing token" }, { status: 400 });
  }
  const supabase = getSupabaseServer();
  if (!supabase) {
    return NextResponse.json({ error: "Not configured" }, { status: 503 });
  }
  const tokenHash = createHash("sha256").update(token).digest("hex");

  const { data, error } = await supabase
    .from("share_links")
    .select("scope, scope_id, params, expires_at")
    .eq("token_hash", tokenHash)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Link expired or invalid" }, { status: 404 });
  }
  const expiresAt = new Date(data.expires_at);
  if (expiresAt <= new Date()) {
    return NextResponse.json({ error: "Link expired or invalid" }, { status: 404 });
  }

  await supabase
    .from("share_links")
    .update({ last_accessed_at: new Date().toISOString() })
    .eq("token_hash", tokenHash);

  return NextResponse.json({
    scope: data.scope,
    scopeId: data.scope_id ?? undefined,
    params: data.params ?? undefined,
    expiresAt: data.expires_at,
  });
}
