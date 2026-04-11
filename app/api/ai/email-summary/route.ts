import { NextRequest, NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/session";

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
const DEEPSEEK_URL = "https://api.deepseek.com/chat/completions";

export async function POST(request: NextRequest) {
  if (!DEEPSEEK_API_KEY) {
    return NextResponse.json({ error: "AI not configured" }, { status: 503 });
  }

  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { prompt, maxTokens } = (await request.json()) as { prompt?: string; maxTokens?: number };
    if (!prompt || typeof prompt !== "string") {
      return NextResponse.json({ error: "Missing prompt" }, { status: 400 });
    }
    const cappedMaxTokens =
      typeof maxTokens === "number" && Number.isFinite(maxTokens)
        ? Math.max(100, Math.min(700, Math.floor(maxTokens)))
        : 250;

    const res = await fetch(DEEPSEEK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          {
            role: "system",
            content:
              "You write concise, natural SEO email updates. Follow the user's instructions exactly. Output plain text only.",
          },
          { role: "user", content: prompt },
        ],
        temperature: 0.5,
        max_tokens: cappedMaxTokens,
      }),
    });

    if (!res.ok) {
      const err = await res.text().catch(() => "Unknown error");
      console.error("[AI email-summary] DeepSeek error:", res.status, err);
      return NextResponse.json({ error: "AI service unavailable" }, { status: 503 });
    }

    const data = await res.json();
    const text = data.choices?.[0]?.message?.content?.trim() ?? null;
    if (!text) {
      return NextResponse.json({ error: "Could not generate update" }, { status: 502 });
    }

    return NextResponse.json({ text });
  } catch (e) {
    console.error("[AI email-summary]", e);
    return NextResponse.json({ error: "Could not generate update" }, { status: 500 });
  }
}
