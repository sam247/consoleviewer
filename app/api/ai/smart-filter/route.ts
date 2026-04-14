import { NextRequest, NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/session";

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
const DEEPSEEK_URL = "https://api.deepseek.com/chat/completions";

type SmartFilters = {
  text_contains?: string;
  text_not_contains?: string;
  position_min?: number;
  position_max?: number;
  ctr_max?: number;
  impressions_min?: number;
  clicks_min?: number;
};

type SmartNumKey = "position_min" | "position_max" | "ctr_max" | "impressions_min" | "clicks_min";
type SmartStrKey = "text_contains" | "text_not_contains";

function buildPrompt({
  input,
  dimension,
  domain,
}: {
  input: string;
  dimension: "query" | "page" | "keyword";
  domain?: string;
}) {
  const hint = domain ? `Domain context (optional): ${domain}` : "";
  return `You convert natural language into structured table filters.

Output STRICT JSON only (no markdown, no commentary). Return an object with this shape:
{
  "text_contains": string | undefined,
  "text_not_contains": string | undefined,
  "position_min": number | undefined,
  "position_max": number | undefined,
  "ctr_max": number | undefined,
  "impressions_min": number | undefined,
  "clicks_min": number | undefined
}

Rules:
- Do not output regex.
- Use CTR as a percentage number (e.g. 1.2 means 1.2%).
- Prefer numeric ranges for position queries.
- If the user asks for "brand" terms and you can infer a brand from the domain, set text_contains to that brand token.
- If a value is not present, omit the key.
- Only include keys listed above.

Dimension: ${dimension}
${hint}

User input: ${input}`;
}

function safeParseJson(text: string): SmartFilters | null {
  try {
    const parsed = JSON.parse(text) as unknown;
    if (!parsed || typeof parsed !== "object") return null;
    const obj = parsed as Record<string, unknown>;
    const out: SmartFilters = {};
    const takeNum = (k: SmartNumKey) => {
      const v = obj[k];
      if (typeof v === "number" && Number.isFinite(v)) out[k] = v;
    };
    const takeStr = (k: SmartStrKey) => {
      const v = obj[k];
      if (typeof v === "string" && v.trim()) out[k] = v.trim();
    };
    takeStr("text_contains");
    takeStr("text_not_contains");
    takeNum("position_min");
    takeNum("position_max");
    takeNum("ctr_max");
    takeNum("impressions_min");
    takeNum("clicks_min");
    return out;
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  if (!DEEPSEEK_API_KEY) {
    return NextResponse.json({ error: "AI not configured" }, { status: 503 });
  }

  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await request.json()) as {
      input?: string;
      dimension?: "query" | "page" | "keyword";
      domain?: string;
    };
    const input = (body.input ?? "").trim();
    const dimension = body.dimension;
    const domain = typeof body.domain === "string" ? body.domain.trim() : undefined;
    if (!input || !dimension) {
      return NextResponse.json({ error: "Missing input or dimension" }, { status: 400 });
    }

    const prompt = buildPrompt({ input, dimension, domain });
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
          { role: "user", content: prompt },
        ],
        temperature: 0.2,
        max_tokens: 220,
      }),
    });

    if (!res.ok) {
      const err = await res.text().catch(() => "Unknown error");
      console.error("[AI smart-filter] DeepSeek error:", res.status, err);
      return NextResponse.json({ error: "Could not parse filter" }, { status: 502 });
    }

    const data = await res.json();
    const text = data.choices?.[0]?.message?.content?.trim() ?? "";
    const filters = safeParseJson(text);
    if (!filters) {
      return NextResponse.json({ error: "Could not parse filter" }, { status: 200 });
    }

    return NextResponse.json({ filters });
  } catch (e) {
    console.error("[AI smart-filter]", e);
    return NextResponse.json({ error: "Could not parse filter" }, { status: 500 });
  }
}
