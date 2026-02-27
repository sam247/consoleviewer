import { NextRequest, NextResponse } from "next/server";
import { createSessionCookie } from "@/lib/session";

export async function POST(request: NextRequest) {
  const email = process.env.APP_LOGIN_EMAIL;
  const password = process.env.APP_LOGIN_PASSWORD;
  if (!email || !password) {
    return NextResponse.json(
      { error: "App login not configured (missing APP_LOGIN_EMAIL or APP_LOGIN_PASSWORD)" },
      { status: 500 }
    );
  }
  let body: { email?: string; password?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const givenEmail = (body.email ?? "").trim().toLowerCase();
  const givenPassword = body.password ?? "";
  if (givenEmail !== email.trim().toLowerCase() || givenPassword !== password) {
    return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
  }
  try {
    const { name, value, options } = createSessionCookie();
    const res = NextResponse.json({ ok: true }, { status: 200 });
    res.cookies.set(name, value, options);
    return res;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Session error";
    return NextResponse.json(
      { error: process.env.NODE_ENV === "development" ? msg : "Session error" },
      { status: 500 }
    );
  }
}
