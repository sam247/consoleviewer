"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { DataTableRow } from "@/components/data-table";
import { ReportModal } from "@/components/report-modal";
import { cn } from "@/lib/utils";
import type { Summary } from "@/hooks/use-property-data";

type EmailContext = {
  domain: string;
  date_range: string;
  sender_name: string;

  clicks: number;
  clicks_change: string;

  impressions: number;
  impressions_change: string;

  ctr: string;
  ctr_change: string;

  position: number;
  position_change: string;

  signals: string[];
  opportunities: string[];
};

function formatSignedPercent(value?: number): string {
  if (value == null || Number.isNaN(value)) return "—";
  const v = Math.round(value);
  return `${v > 0 ? "+" : ""}${v}%`;
}

function extractPath(value: string): string {
  const v = value.trim();
  if (!v) return "/";
  try {
    if (v.startsWith("http://") || v.startsWith("https://")) return new URL(v).pathname || "/";
  } catch {}
  if (v.startsWith("/")) return v;
  return "/";
}

function contentSignalFromPages(pagesRows: DataTableRow[]): string | null {
  const groups = new Map<string, { w: number; v: number }>();
  for (const p of pagesRows) {
    const path = extractPath(p.key);
    const seg = path.split("/").filter(Boolean)[0] ?? "(root)";
    if (!seg || seg === "cdn") continue;
    if (p.impressionsChangePercent == null) continue;
    const w = Math.max(1, p.impressions || p.clicks || 1);
    const cur = groups.get(seg) ?? { w: 0, v: 0 };
    cur.w += w;
    cur.v += w * p.impressionsChangePercent;
    groups.set(seg, cur);
  }
  const ranked = Array.from(groups.entries())
    .map(([k, agg]) => ({ k, avg: agg.w > 0 ? agg.v / agg.w : 0 }))
    .filter((x) => Number.isFinite(x.avg))
    .sort((a, b) => Math.abs(b.avg) - Math.abs(a.avg));
  const top = ranked[0];
  if (!top) return null;
  const dir = top.avg >= 0 ? "↑" : "↓";
  return `Content: ${top.k} ${dir} ${formatSignedPercent(top.avg)}`;
}

function expectedCtrForPosition(pos: number): number {
  if (pos <= 3) return 6.0;
  if (pos <= 5) return 3.5;
  if (pos <= 8) return 2.2;
  if (pos <= 12) return 1.4;
  if (pos <= 15) return 1.0;
  return 0.8;
}

function buildOpportunities(queriesRows: DataTableRow[]): string[] {
  const threshold = 1000;
  const filtered = queriesRows
    .map((q) => {
      const pos = q.position ?? null;
      const impr = q.impressions ?? 0;
      const clicks = q.clicks ?? 0;
      if (pos == null || !Number.isFinite(pos)) return null;
      if (pos < 4 || pos > 15) return null;
      if (impr < threshold) return null;
      const ctr = impr > 0 ? (clicks / impr) * 100 : 0;
      const expected = expectedCtrForPosition(pos);
      const gap = Math.max(0, expected - ctr);
      if (gap < 0.2) return null;
      const score = impr * gap;
      return { query: q.key, pos, impr, ctr, expected, score };
    })
    .filter((x): x is NonNullable<typeof x> => x != null)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  return filtered.map((o) => `${o.query} — ranking ${o.pos.toFixed(1)} with high impressions but low CTR`);
}

function buildSignals(summary: Summary | null, newQueries: DataTableRow[], lostQueries: DataTableRow[], pagesRows: DataTableRow[]): string[] {
  const out: string[] = [];
  if (summary?.clicksChangePercent != null) {
    const v = Math.round(summary.clicksChangePercent);
    out.push(`Clicks ${v > 0 ? "up" : "down"} ${Math.abs(v)}%`);
  }
  const newQ = [...newQueries].sort((a, b) => b.clicks - a.clicks)[0];
  if (newQ) out.push(`New ranking: ${newQ.key}`);
  const lostQ = [...lostQueries].sort((a, b) => b.clicks - a.clicks)[0];
  if (lostQ) out.push(`Lost traffic: ${lostQ.key}`);
  const content = contentSignalFromPages(pagesRows);
  if (content) out.push(content);
  return out.slice(0, 5);
}

function buildEmailPrompt(ctx: EmailContext, variant: "default" | "long"): string {
  const summaryTarget = variant === "long" ? "260–320" : "200–240";
  const structureLine = "Structure (no headings): overall change → drivers → opportunities → close.";

  return `Generate a concise SEO performance email update.

Context:
- Website: ${ctx.domain}
- Time period: ${ctx.date_range}
- Metrics:
  - Clicks: ${ctx.clicks} (${ctx.clicks_change})
  - Impressions: ${ctx.impressions} (${ctx.impressions_change})
  - CTR: ${ctx.ctr} (${ctx.ctr_change})
  - Avg position: ${ctx.position} (${ctx.position_change})

Summary paragraph target: ${summaryTarget} words

Use these signals and opportunities for specificity (don’t label sections in the email):
Signals:
${ctx.signals.slice(0, 4).map((s) => `- ${s}`).join("\n")}
Opportunities:
${ctx.opportunities.slice(0, 4).map((o) => `- ${o}`).join("\n")}

Drivers (wins/losses/opportunities) candidates:
${[...ctx.signals.slice(0, 3), ...ctx.opportunities.slice(0, 2)].map((s) => `- ${s}`).join("\n")}

Rules:
- Write in natural, human tone (not AI-like)
- Avoid generic phrases
- Avoid repeating raw metrics without explanation
- Focus on the most likely cause of change (CTR, rankings, or demand)
- Use at least one specific example from the signals or opportunities
- No emojis
- No fluff
- No recommendations or advice
- Do not use phrases like “the data suggests” or “there is a need to”
- Avoid filler phrases like “interestingly”, “it appears”, “this suggests”
- Keep sentences tight and direct
- Minimum 200 words (do not go below 200)

${structureLine}

Formatting rules:
- Do not include section headers like "Performance summary", "Key drivers", or "Opportunities"
- Write as a natural flowing email using short paragraphs
- Use natural paragraph breaks instead of headings
- After “Hi,” add this exact line on its own: Here’s a quick update on performance.
- Ensure there is one blank line between “Hi,” and that line
- If there are 3+ distinct drivers (wins/losses/opportunities), use a short bullet list for drivers only
- Otherwise keep everything in paragraph form

Output:
Plain text email ready to send.

Format:
- Start with: Subject: SEO Update: ${ctx.date_range}
- Then: Hi,
- Then a blank line
- Then: Here’s a quick update on performance.
- Then the email body
- End with a sign-off: Thanks,\n${ctx.sender_name}`;
}

export function EmailSummaryGenerator({
  domain,
  startDate,
  endDate,
  summary,
  newQueries,
  lostQueries,
  pagesRows,
  queriesRows,
  className,
}: {
  domain: string;
  startDate?: string;
  endDate?: string;
  summary: Summary | null;
  newQueries: DataTableRow[];
  lostQueries: DataTableRow[];
  pagesRows: DataTableRow[];
  queriesRows: DataTableRow[];
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [copied, setCopied] = useState(false);
  const [variant, setVariant] = useState<"default" | "long">("default");
  const [senderName, setSenderName] = useState<string>("");
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [pendingGenerate, setPendingGenerate] = useState(false);

  useEffect(() => {
    if (!open) return;
    let canceled = false;
    (async () => {
      try {
        const res = await fetch("/api/user/profile", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as { displayName?: string; email?: string };
        const displayName = (data.displayName ?? "").trim();
        const email = (data.email ?? "").trim();
        const fallback = email ? email.split("@")[0] ?? email : "";
        const name = displayName || fallback || "Consoleview";
        if (!canceled) setSenderName(name);
      } catch {}
      finally {
        if (!canceled) setProfileLoaded(true);
      }
    })();
    return () => {
      canceled = true;
    };
  }, [open]);

  const normalizedDomain = useMemo(() => {
    const d = domain.trim();
    if (!d) return "";
    try {
      if (d.startsWith("http://") || d.startsWith("https://")) return new URL(d).host;
    } catch {}
    return d.replace(/^www\./, "");
  }, [domain]);

  const ctx = useMemo<EmailContext | null>(() => {
    if (!summary) return null;
    const date_range = startDate && endDate ? `${startDate} to ${endDate}` : "Current period";
    const signals = buildSignals(summary, newQueries, lostQueries, pagesRows);
    const opportunities = buildOpportunities(queriesRows);
    return {
      domain: normalizedDomain,
      date_range,
      sender_name: senderName || "Consoleview",
      clicks: Math.round(summary.clicks),
      clicks_change: formatSignedPercent(summary.clicksChangePercent),
      impressions: Math.round(summary.impressions),
      impressions_change: formatSignedPercent(summary.impressionsChangePercent),
      ctr: summary.ctr != null ? `${summary.ctr.toFixed(2)}%` : "—",
      ctr_change: formatSignedPercent(summary.ctrChangePercent),
      position: summary.position != null ? Number(summary.position.toFixed(1)) : 0,
      position_change: formatSignedPercent(summary.positionChangePercent),
      signals: signals.length ? signals : ["No major signals detected"],
      opportunities: opportunities.length ? opportunities : ["No clear opportunities detected"],
    };
  }, [endDate, lostQueries, newQueries, normalizedDomain, pagesRows, queriesRows, senderName, startDate, summary]);

  const generate = useCallback(async (nextVariant: "default" | "long") => {
    if (!ctx) return;
    setLoading(true);
    setError(null);
    setCopied(false);
    try {
      const prompt = buildEmailPrompt(ctx, nextVariant);
      const res = await fetch("/api/ai/email-summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, maxTokens: nextVariant === "long" ? 700 : 520 }),
      });
      if (!res.ok) {
        const msg = (await res.json().catch(() => null)) as unknown;
        const errorText =
          msg && typeof msg === "object" && "error" in msg && typeof (msg as { error?: unknown }).error === "string"
            ? (msg as { error: string }).error
            : "Could not generate update";
        throw new Error(errorText);
      }
      const data = (await res.json()) as { text: string };
      setText(data.text ?? "Could not generate update");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not generate update");
      setText("Could not generate update");
    } finally {
      setLoading(false);
    }
  }, [ctx]);

  useEffect(() => {
    if (!open) return;
    if (!pendingGenerate) return;
    if (!ctx) return;
    if (loading) return;
    if (!profileLoaded) return;
    setVariant("default");
    setPendingGenerate(false);
    generate("default");
  }, [ctx, generate, loading, open, pendingGenerate, profileLoaded]);

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          if (!text) {
            setProfileLoaded(false);
            setPendingGenerate(true);
          }
        }}
        data-menu-close="true"
        className={cn(
          "flex h-10 w-10 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-accent hover:text-foreground",
          className
        )}
        aria-label="Generate update"
        title="Generate update"
      >
        <span className="sr-only">Generate update</span>
        <svg
          className="h-4 w-4"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
            <rect x="3" y="5" width="18" height="14" rx="2" />
            <path d="M3 7l9 6 9-6" />
        </svg>
      </button>

      <ReportModal
        open={open}
        onClose={() => setOpen(false)}
        title="SEO Email Update"
        subtitle={domain}
        actions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(text);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1200);
                } catch {
                  setCopied(false);
                }
              }}
              disabled={!text || loading}
              className="text-xs text-muted-foreground hover:text-foreground underline disabled:opacity-50"
            >
              {copied ? "Copied" : "Copy"}
            </button>
            <button
              type="button"
              onClick={() => generate(variant)}
              disabled={!ctx || loading}
              className="text-xs text-muted-foreground hover:text-foreground underline disabled:opacity-50"
            >
              Regenerate
            </button>
            <button
              type="button"
              onClick={() => {
                setVariant("long");
                generate("long");
              }}
              disabled={!ctx || loading}
              className="text-xs text-muted-foreground hover:text-foreground underline disabled:opacity-50"
            >
              Make longer
            </button>
          </div>
        }
      >
        <div className="p-4">
          {error ? <div className="mb-3 text-xs text-negative">{error}</div> : null}
          <div className="relative">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="w-full min-h-[360px] max-h-[60vh] resize-y rounded-md border border-input bg-background px-3 py-2 text-sm leading-relaxed"
              spellCheck={false}
            />
            {loading ? (
              <div className="absolute inset-0 flex items-center justify-center bg-background/70">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" aria-label="Loading" />
              </div>
            ) : null}
          </div>
          {ctx ? (
            <div className="mt-3 text-xs text-muted-foreground">
              Signals: {ctx.signals.slice(0, 3).join(" • ")}
              <span className="mx-2">•</span>
              Opportunities: {ctx.opportunities.length}
            </div>
          ) : (
            <div className="mt-3 text-xs text-muted-foreground">No data available yet.</div>
          )}
        </div>
      </ReportModal>
    </>
  );
}
