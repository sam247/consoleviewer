/**
 * Session verification for Edge (middleware). Uses Web Crypto for HMAC.
 * Must match the signature produced by lib/session.ts (Node).
 */

const COOKIE_NAME = "consoleview_app_session";
const SIG_LEN = 32;

export function getCookieName(): string {
  return COOKIE_NAME;
}

async function hmacSha256Hex(secret: string, data: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(data));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, SIG_LEN);
}

export async function verifySessionCookie(
  cookieValue: string,
  secret: string
): Promise<boolean> {
  const lastDot = cookieValue.lastIndexOf(".");
  if (lastDot === -1 || secret.length < 16) return false;
  const value = cookieValue.slice(0, lastDot);
  const expectedSig = await hmacSha256Hex(secret, value);
  const actualSig = cookieValue.slice(lastDot + 1);
  return expectedSig === actualSig;
}
