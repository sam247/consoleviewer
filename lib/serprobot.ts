/**
 * SerpRobot API client. Server-side only; never expose API key to client.
 * Base URL: https://api.serprobot.com/v1/api.php
 * Auth: api_key query parameter.
 */

const SERPROBOT_BASE = "https://api.serprobot.com/v1/api.php";

export async function serprobotFetch(
  action: string,
  params: Record<string, string> = {}
): Promise<unknown> {
  const key = process.env.SERPROBOT_API_KEY;
  if (!key?.trim()) {
    throw new Error("SERPROBOT_API_KEY is not set");
  }
  const search = new URLSearchParams({
    api_key: key,
    action,
    ...params,
  });
  const url = `${SERPROBOT_BASE}?${search.toString()}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`SerpRobot API error: ${res.status}`);
  }
  return res.json();
}

export function hasSerprobotKey(): boolean {
  return Boolean(process.env.SERPROBOT_API_KEY?.trim());
}
