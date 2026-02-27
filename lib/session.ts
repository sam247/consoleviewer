import { cookies } from "next/headers";

const COOKIE_NAME = "consoleview_app_session";
const MAX_AGE = 60 * 60 * 24 * 7; // 7 days

function getSecret(): string {
  const secret = process.env.APP_SESSION_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error("APP_SESSION_SECRET must be set and at least 16 characters");
  }
  return secret;
}

function sign(value: string, secret: string): string {
  const { createHmac } = require("crypto");
  const hmac = createHmac("sha256", secret);
  hmac.update(value);
  return `${value}.${hmac.digest("hex").slice(0, 32)}`;
}

function verify(signed: string, secret: string): boolean {
  const lastDot = signed.lastIndexOf(".");
  if (lastDot === -1) return false;
  const value = signed.slice(0, lastDot);
  const expected = sign(value, secret);
  return signed === expected;
}

export function createSessionCookie(): { name: string; value: string; options: { httpOnly: boolean; secure: boolean; sameSite: "lax"; maxAge: number; path: string } } {
  const secret = getSecret();
  const payload = `logged_in:${Date.now()}`;
  const value = sign(payload, secret);
  return {
    name: COOKIE_NAME,
    value,
    options: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: MAX_AGE,
      path: "/",
    },
  };
}

export function getSessionCookie(): string | undefined {
  return undefined;
}

export async function setSession(res: Response): Promise<Response> {
  const secret = getSecret();
  const payload = `logged_in:${Date.now()}`;
  const value = sign(payload, secret);
  res.headers.append(
    "Set-Cookie",
    `${COOKIE_NAME}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${MAX_AGE}${process.env.NODE_ENV === "production" ? "; Secure" : ""}`
  );
  return res;
}

export async function hasValidSession(): Promise<boolean> {
  const cookieStore = await cookies();
  const cookie = cookieStore.get(COOKIE_NAME);
  if (!cookie?.value) return false;
  try {
    const secret = getSecret();
    return verify(cookie.value, secret);
  } catch {
    return false;
  }
}

export function getCookieName(): string {
  return COOKIE_NAME;
}
