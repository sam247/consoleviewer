import type {
  BiggestChangesResult,
  MovementSummaryResult,
  OpportunitiesResult,
  ProjectsAttentionResult,
  ToolName,
} from "@/mcp/types";

export type UiListItem = {
  primary: string;
  meta: string[];
};

export type UiSection = {
  label?: string;
  items: UiListItem[];
};

export type UiResponse = {
  summary: string;
  sections: UiSection[];
  csv?: { filename: string; rows: Record<string, string | number | undefined>[] };
};

function formatSignedPercent(n: number): string {
  const v = Math.round(n);
  return `${v > 0 ? "+" : ""}${v}%`;
}

function formatCompact(n: number): string {
  const v = Math.round(n);
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}k`;
  return String(v);
}

function formatPosChange(from: number, to: number): string {
  const delta = to - from;
  const d = Number(delta.toFixed(1));
  const arrow = d > 0 ? "↑" : d < 0 ? "↓" : "→";
  return `${from.toFixed(1)}→${to.toFixed(1)} (${arrow}${Math.abs(d).toFixed(1)})`;
}

function formatClicksChange(n: number): string {
  const v = Math.round(n);
  return `${v > 0 ? "+" : ""}${v}`;
}

function shortenUrl(url: string): string {
  try {
    if (url.startsWith("http")) {
      const u = new URL(url);
      return u.pathname || "/";
    }
  } catch {}
  return url;
}

export function shapeMcpResponse(method: ToolName, result: unknown): UiResponse {
  switch (method) {
    case "get_movement_summary":
      return shapeMovementSummary(result as MovementSummaryResult);
    case "get_biggest_losers":
      return shapeRankedChanges(result as BiggestChangesResult, "Biggest losers", "losers");
    case "get_biggest_winners":
      return shapeRankedChanges(result as BiggestChangesResult, "Biggest winners", "winners");
    case "get_opportunities":
      return shapeOpportunities(result as OpportunitiesResult);
    case "get_projects_attention":
      return shapeProjectsAttention(result as ProjectsAttentionResult);
    default:
      return { summary: "No significant changes found in this period", sections: [] };
  }
}

export function uiResponseToText(input: UiResponse): string {
  const lines: string[] = [];
  lines.push(input.summary);
  for (const section of input.sections) {
    if (!section.items.length) continue;
    lines.push("");
    if (section.label) lines.push(section.label);
    for (const item of section.items) {
      lines.push(`- ${item.primary}`);
      for (const meta of item.meta) {
        lines.push(`  • ${meta}`);
      }
    }
  }
  return lines.join("\n").trim();
}

function shapeMovementSummary(input: MovementSummaryResult): UiResponse {
  const declines = input.declines?.slice(0, 8) ?? [];
  const gains = input.gains?.slice(0, 8) ?? [];
  const empty = declines.length === 0 && gains.length === 0;
  const summary = empty ? "No significant changes found in this period" : input.summary || "Movement summary";

  return {
    summary,
    sections: [
      {
        label: "↓ Declines",
        items: declines.map((r) => ({
          primary: r.query,
          meta: [
            `position ${formatPosChange(r.position_from, r.position_to)}`,
            `clicks ${formatClicksChange(r.clicks_change)}`,
          ],
        })),
      },
      {
        label: "↑ Gains",
        items: gains.map((r) => ({
          primary: r.query,
          meta: [
            `position ${formatPosChange(r.position_from, r.position_to)}`,
            `clicks ${formatClicksChange(r.clicks_change)}`,
          ],
        })),
      },
    ],
    csv: {
      filename: "movement-summary.csv",
      rows: [
        ...declines.map((r) => ({
          direction: "decline",
          query: r.query,
          clicks_change: r.clicks_change,
          position_from: r.position_from,
          position_to: r.position_to,
          page: r.page ?? "",
        })),
        ...gains.map((r) => ({
          direction: "gain",
          query: r.query,
          clicks_change: r.clicks_change,
          position_from: r.position_from,
          position_to: r.position_to,
          page: r.page ?? "",
        })),
      ],
    },
  };
}

function shapeRankedChanges(input: BiggestChangesResult, title: string, slug: string): UiResponse {
  const rows = input.data?.slice(0, 10) ?? [];
  const summary = rows.length ? input.summary || title : "No significant changes found in this period";
  return {
    summary,
    sections: [
      {
        items: rows.map((r, idx) => ({
          primary: `${idx + 1}. ${r.query}`,
          meta: [
            `clicks ${formatClicksChange(r.clicks_change)}`,
            `position ${formatPosChange(r.position_from, r.position_to)}`,
            `page ${r.page ? shortenUrl(r.page) : "—"}`,
          ],
        })),
      },
    ],
    csv: {
      filename: `${slug}.csv`,
      rows: rows.map((r) => ({
        query: r.query,
        clicks_change: r.clicks_change,
        position_from: r.position_from,
        position_to: r.position_to,
        page: r.page ?? "",
      })),
    },
  };
}

function shapeOpportunities(input: OpportunitiesResult): UiResponse {
  const rows = input.data?.slice(0, 10) ?? [];
  const summary = rows.length ? input.summary || "Top opportunities" : "No significant changes found in this period";

  return {
    summary,
    sections: [
      {
        label: "Top Opportunities",
        items: rows.map((r, idx) => ({
          primary: `${idx + 1}. ${r.query}`,
          meta: [
            `position ${r.position.toFixed(1)}`,
            `impressions ${formatCompact(r.impressions)}`,
            `page ${r.page ? shortenUrl(r.page) : "—"}`,
          ],
        })),
      },
    ],
    csv: {
      filename: "opportunities.csv",
      rows: rows.map((r) => ({
        query: r.query,
        position: r.position,
        impressions: r.impressions,
        ctr: r.ctr,
        page: r.page ?? "",
      })),
    },
  };
}

function shapeProjectsAttention(input: ProjectsAttentionResult): UiResponse {
  const rows = input.data?.slice(0, 10) ?? [];
  const summary = rows.length ? input.summary || "Projects needing attention" : "No significant changes found in this period";

  return {
    summary,
    sections: [
      {
        label: "Projects Needing Attention",
        items: rows.map((r, idx) => ({
          primary: `${idx + 1}. ${r.project}`,
          meta: [`traffic change ${formatSignedPercent(r.traffic_change)}`, `issue ${r.primary_issue}`],
        })),
      },
    ],
    csv: {
      filename: "projects-attention.csv",
      rows: rows.map((r) => ({
        project: r.project,
        traffic_change: r.traffic_change,
        primary_issue: r.primary_issue,
      })),
    },
  };
}

