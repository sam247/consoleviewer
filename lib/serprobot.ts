/**
 * SerpRobot API client. Server-side only; never expose API key to client.
 * Base URL: https://api.serprobot.com/v1/api.php
 * Auth: api_key query parameter.
 */

const SERPROBOT_BASE = "https://api.serprobot.com/v1/api.php";

function parseSerprobotError(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const data = payload as Record<string, unknown>;

  const explicitError =
    typeof data.error === "string" && data.error.trim().length > 0
      ? data.error.trim()
      : typeof data.errors === "string" && data.errors.trim().length > 0
        ? data.errors.trim()
        : null;
  if (explicitError) return explicitError;

  const status = typeof data.status === "string" ? data.status.toLowerCase() : "";
  const result = typeof data.result === "string" ? data.result.toLowerCase() : "";
  const successRaw = data.success;
  const success =
    typeof successRaw === "boolean"
      ? successRaw
      : typeof successRaw === "number"
        ? successRaw !== 0
        : typeof successRaw === "string"
          ? !["0", "false", "no", "fail", "failed", "error"].includes(successRaw.toLowerCase())
          : null;

  const isFailedStatus = ["error", "fail", "failed"].includes(status) || ["error", "fail", "failed"].includes(result);
  if (isFailedStatus || success === false) {
    const message =
      typeof data.message === "string" && data.message.trim().length > 0
        ? data.message.trim()
        : typeof data.msg === "string" && data.msg.trim().length > 0
          ? data.msg.trim()
          : "SerpRobot API returned an unsuccessful response";
    return message;
  }

  return null;
}

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
  const data = (await res.json()) as unknown;
  const logicalError = parseSerprobotError(data);
  if (logicalError) {
    throw new Error(logicalError);
  }
  return data;
}

export function hasSerprobotKey(): boolean {
  return Boolean(process.env.SERPROBOT_API_KEY?.trim());
}
