import { NextRequest, NextResponse } from "next/server";
import { exchangeCodeForTokens } from "@/lib/google-auth";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const error = request.nextUrl.searchParams.get("error");
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;

  if (error) {
    return new NextResponse(
      `<html><body><h1>Auth error</h1><p>${error}</p><a href="/">Back</a></body></html>`,
      { headers: { "Content-Type": "text/html" } }
    );
  }

  if (!code || !redirectUri) {
    return new NextResponse(
      "<html><body><h1>Missing code or GOOGLE_REDIRECT_URI</h1><a href=\"/\">Back</a></body></html>",
      { status: 400, headers: { "Content-Type": "text/html" } }
    );
  }

  try {
    const tokens = await exchangeCodeForTokens(code, redirectUri);
    const refreshToken = tokens.refresh_token;
    if (!refreshToken) {
      return new NextResponse(
        "<html><body><h1>No refresh_token in response</h1><p>Try revoking app access at <a href='https://myaccount.google.com/permissions'>Google permissions</a> and sign in again with prompt=consent.</p><a href='/'>Back</a></body></html>",
        { status: 400, headers: { "Content-Type": "text/html" } }
      );
    }
    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Consoleview – Add refresh token</title></head>
<body style="font-family: system-ui; max-width: 560px; margin: 2rem auto; padding: 0 1rem;">
  <h1>Refresh token</h1>
  <p>Add this value to your Vercel project as <strong>GOOGLE_REFRESH_TOKEN</strong>, then redeploy.</p>
  <pre style="background: #f5f5f5; padding: 1rem; overflow-x: auto; word-break: break-all;">${refreshToken}</pre>
  <p><a href="/">Back to app</a> · <a href="/api/auth/google">Sign in again</a></p>
</body>
</html>`;
    return new NextResponse(html, {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return new NextResponse(
      `<html><body><h1>Token exchange failed</h1><pre>${encodeURIComponent(message)}</pre><a href="/">Back</a></body></html>`,
      { status: 500, headers: { "Content-Type": "text/html" } }
    );
  }
}
