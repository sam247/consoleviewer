import { NextRequest, NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/session";

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
const DEEPSEEK_URL = "https://api.deepseek.com/chat/completions";

type Intent =
  | "movement_summary"
  | "biggest_losers"
  | "biggest_winners"
  | "opportunities"
  | "projects_attention"
  | "not_found_pages"
  | "unsupported";

function buildPrompt(input: string) {
  return `You map a user's question to one of a small set of analytics intents.

Return STRICT JSON only (no markdown, no commentary) in this exact shape:
{ "intent": "<intent>" }

Valid intents:
- movement_summary
- biggest_losers
- biggest_winners
- opportunities
- projects_attention
- not_found_pages
- unsupported

Rules:
- Only choose an intent if the user is clearly asking for that.
- If the user asks for 404 pages (not found pages) as a report/export, choose "not_found_pages".
- If the user asks for status codes beyond not-found pages, indexing, crawl errors, or anything not in GSC performance metrics, choose "unsupported".
- If unsure, choose "unsupported".

User question: ${input}`;
}

function safeParse(text: string): { intent: Intent } | null {
  try {
    const parsed = JSON.parse(text) as unknown;
    if (!parsed || typeof parsed !== "object") return null;
    const obj = parsed as Record<string, unknown>;
    const intent = obj.intent;
    if (
      intent === "movement_summary" ||
      intent === "biggest_losers" ||
      intent === "biggest_winners" ||
      intent === "opportunities" ||
      intent === "projects_attention" ||
      intent === "not_found_pages" ||
      intent === "unsupported"
    ) {
      return { intent: intent as Intent };
    }
    return null;
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!DEEPSEEK_API_KEY) {
    return NextResponse.json({ error: "AI not configured" }, { status: 503 });
  }

  const body = (await request.json().catch(() => null)) as { input?: string } | null;
  const input = (body?.input ?? "").trim();
  if (!input) return NextResponse.json({ error: "Missing input" }, { status: 400 });

  try {
    const res = await fetch(DEEPSEEK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          { role: "system", content: "Return JSON only." },
          { role: "user", content: buildPrompt(input) },
        ],
        temperature: 0,
        max_tokens: 80,
      }),
    });

    if (!res.ok) {
      return NextResponse.json({ intent: "unsupported" satisfies Intent });
    }

    const data = await res.json();
    const text = data.choices?.[0]?.message?.content?.trim() ?? "";
    const parsed = safeParse(text);
    return NextResponse.json(parsed ?? { intent: "unsupported" satisfies Intent });
  } catch {
    return NextResponse.json({ intent: "unsupported" satisfies Intent });
  }
}
