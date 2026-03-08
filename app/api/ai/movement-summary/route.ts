import { NextRequest, NextResponse } from "next/server";
import { runMcpShadowAssist } from "@/lib/ai/mcp-shadow";
import { logAiToolExecution } from "@/lib/ai/ai-logs";
import { createMcpCallBudgetContext } from "@/lib/mcp-client";
import { getSessionUserId } from "@/lib/session";

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
const DEEPSEEK_URL = "https://api.deepseek.com/chat/completions";

type MovementSummarySignal = {
  direction: string;
  sentence: string;
};

function buildFallbackQuestion(
  propertyId: string | undefined,
  signals: MovementSummarySignal[]
): string {
  const topSignals = signals.slice(0, 3).map((s) => `${s.direction}: ${s.sentence}`).join("; ");
  return `Summarize recent SEO movement for site ${propertyId ?? "unknown"}. Signals: ${topSignals}`;
}

export async function POST(request: NextRequest) {
  if (!DEEPSEEK_API_KEY) {
    return NextResponse.json({ error: "AI not configured" }, { status: 503 });
  }

  const requestStartedAt = Date.now();
  const timestamp = new Date().toISOString();
  let logUserId = "anonymous";
  let logPropertyId = "unknown";
  let logToolCalled: Parameters<typeof logAiToolExecution>[0]["toolCalled"] = "none";
  let logStatus: Parameters<typeof logAiToolExecution>[0]["status"] = "fallback";

  try {
    const { signals, propertyId, question } = (await request.json()) as {
      signals?: MovementSummarySignal[];
      propertyId?: string;
      question?: string;
    };

    logPropertyId = propertyId ?? "unknown";

    if (!signals || !Array.isArray(signals) || signals.length === 0) {
      logStatus = "error";
      return NextResponse.json({ summary: null });
    }

    const signalText = signals
      .map((s) => `${s.direction === "growing" ? "↑" : "↓"} ${s.sentence}`)
      .join("\n");

    let systemContext =
      "You are an SEO analyst assistant. Given movement signals for a single website, provide a concise 1-2 sentence summary of the key trends. Focus on actionable insights: what's improving, what needs attention, and any patterns. Be specific to this site only. Do not use markdown formatting. Keep it under 50 words.";

    const userId = await getSessionUserId();
    if (userId) {
      logUserId = userId;
    }

    if (userId && propertyId) {
      const callBudgetContext = createMcpCallBudgetContext(10);
      const shadowQuestion =
        typeof question === "string" && question.trim().length > 0
          ? question.trim()
          : buildFallbackQuestion(propertyId, signals);

      const assist = await runMcpShadowAssist({
        question: shadowQuestion,
        propertyId,
        userId,
        callBudgetContext,
      });

      if (assist.usedMcp && assist.promptContextText) {
        systemContext += `\n\nAnalytics Data:\n${assist.promptContextText}`;
        logToolCalled = assist.toolCalled ?? "none";
        logStatus = "success";
      } else {
        console.info("[AI] MCP fallback reason:", assist.fallbackReason ?? "unknown");
        logToolCalled = assist.toolCalled ?? "none";
        logStatus = "fallback";
      }
    } else {
      console.info("[AI] MCP skipped: missing authenticated user or propertyId");
      logStatus = "fallback";
    }

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
            content: systemContext,
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
      logStatus = "error";
      return NextResponse.json({ summary: null, error: "AI service unavailable" });
    }

    const data = await res.json();
    const summary = data.choices?.[0]?.message?.content?.trim() ?? null;

    return NextResponse.json({ summary });
  } catch (e) {
    console.error("[AI movement-summary]", e);
    logStatus = "error";
    return NextResponse.json({ summary: null, error: "Failed to generate summary" });
  } finally {
    logAiToolExecution({
      timestamp,
      userId: logUserId,
      propertyId: logPropertyId,
      toolCalled: logToolCalled,
      executionTimeMs: Date.now() - requestStartedAt,
      status: logStatus,
    });
  }
}
