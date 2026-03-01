import { NextRequest, NextResponse } from "next/server";
import { createHash, randomBytes } from "crypto";
import { hasValidSession, getOwnerUserId } from "@/lib/session";
import { getSupabaseServer } from "@/lib/supabase";

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
      { error: "Share links not configured. Set Supabase env vars." },
      { status: 503 }
    );
  }
  let body: { scope: "dashboard" | "project"; scopeId?: string; params?: Record<string, unknown>; expiresInDays: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const { scope, scopeId, params, expiresInDays } = body;
  if (scope !== "dashboard" && scope !== "project") {
    return NextResponse.json({ error: "scope must be dashboard or project" }, { status: 400 });
  }
  const days = Number(expiresInDays);
  if (!Number.isFinite(days) || days < 1 || days > 365) {
    return NextResponse.json({ error: "expiresInDays must be between 1 and 365" }, { status: 400 });
  }
  const token = randomBytes(32).toString("hex");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + days);

  const { error } = await supabase.from("share_links").insert({
    token_hash: tokenHash,
    owner_user_id: ownerId,
    scope,
    scope_id: scope === "project" ? scopeId ?? null : null,
    params: params ?? null,
    expires_at: expiresAt.toISOString(),
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const origin = request.nextUrl.origin;
  return NextResponse.json({
    url: `${origin}/s/${token}`,
    expiresAt: expiresAt.toISOString(),
  });
}
