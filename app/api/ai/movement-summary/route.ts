import { NextRequest, NextResponse } from "next/server";

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
const DEEPSEEK_URL = "https://api.deepseek.com/chat/completions";

export async function POST(request: NextRequest) {
  if (!DEEPSEEK_API_KEY) {
    return NextResponse.json({ error: "AI not configured" }, { status: 503 });
  }

  try {
    const { signals, propertyId } = await request.json();

    if (!signals || !Array.isArray(signals) || signals.length === 0) {
      return NextResponse.json({ summary: null });
    }

    const signalText = signals
      .map((s: { direction: string; sentence: string }) => `${s.direction === "growing" ? "↑" : "↓"} ${s.sentence}`)
      .join("\n");

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
              "You are an SEO analyst assistant. Given movement signals for a single website, provide a concise 1-2 sentence summary of the key trends. Focus on actionable insights: what's improving, what needs attention, and any patterns. Be specific to this site only. Do not use markdown formatting. Keep it under 50 words.",
          },
          {
            role: "user",
            content: `Site: ${propertyId ?? "unknown"}\n\nMovement signals:\n${signalText}`,
          },
        ],
        max_tokens: 120,
        temperature: 0.4,
      }),
    });

    if (!res.ok) {
      const err = await res.text().catch(() => "Unknown error");
      console.error("[AI movement-summary] DeepSeek error:", res.status, err);
      return NextResponse.json({ summary: null, error: "AI service unavailable" });
    }

    const data = await res.json();
    const summary = data.choices?.[0]?.message?.content?.trim() ?? null;

    return NextResponse.json({ summary });
  } catch (e) {
    console.error("[AI movement-summary]", e);
    return NextResponse.json({ summary: null, error: "Failed to generate summary" });
  }
}
