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

function limitItems(items: UiListItem[], max: number): UiListItem[] {
  if (items.length <= max) return items;
  const remaining = items.length - max;
  return [...items.slice(0, max), { primary: `+ ${remaining} more`, meta: [] }];
}

function stripDrivenBy(summary: string): string {
  const idx = summary.toLowerCase().indexOf(" driven by");
  return idx >= 0 ? summary.slice(0, idx) : summary;
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
  const declinesRaw = input.declines ?? [];
  const gainsRaw = input.gains ?? [];
  const empty = declinesRaw.length === 0 && gainsRaw.length === 0;
  if (empty) return { summary: "No significant changes found in this period", sections: [] };

  const declinesSorted = [...declinesRaw].sort((a, b) => a.clicks_change - b.clicks_change);
  const main = declinesSorted[0];
  const otherDeclines = declinesSorted.slice(1);

  const mainItem: UiListItem | null = main
    ? {
        primary: main.query,
        meta: [`pos ${main.position_from.toFixed(1)} → ${main.position_to.toFixed(1)}`, `clicks ${formatClicksChange(main.clicks_change)}`],
      }
    : null;

  const otherDeclineItems = otherDeclines.map((r) => ({
    primary: r.query,
    meta: [`pos ${r.position_from.toFixed(1)} → ${r.position_to.toFixed(1)}`, `${formatClicksChange(r.clicks_change)} clicks`],
  }));

  const gainItems = gainsRaw.map((r) => ({
    primary: r.query,
    meta: [`pos ${r.position_from.toFixed(1)} → ${r.position_to.toFixed(1)}`, `${formatClicksChange(r.clicks_change)} clicks`],
  }));

  const summary = stripDrivenBy(input.summary || "Movement summary");

  return {
    summary,
    sections: [
      {
        label: "Main driver",
        items: mainItem ? [mainItem] : [],
      },
      {
        label: "↓ Other declines",
        items: limitItems(otherDeclineItems, 5),
      },
      {
        label: "↑ Gains",
        items: limitItems(gainItems, 5),
      },
    ],
    csv: {
      filename: "movement-summary.csv",
      rows: [
        ...declinesRaw.map((r) => ({
          direction: "decline",
          query: r.query,
          clicks_change: r.clicks_change,
          position_from: r.position_from,
          position_to: r.position_to,
          page: r.page ?? "",
        })),
        ...gainsRaw.map((r) => ({
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
  const rows = input.data ?? [];
  const summary = rows.length ? input.summary || title : "No significant changes found in this period";
  return {
    summary,
    sections: [
      {
        items: limitItems(
          rows.map((r, idx) => ({
          primary: `${idx + 1}. ${r.query}`,
          meta: [
            `clicks ${formatClicksChange(r.clicks_change)}`,
            `position ${formatPosChange(r.position_from, r.position_to)}`,
            `page ${r.page ? shortenUrl(r.page) : "—"}`,
          ],
        })),
          5
        ),
      },
    ],
    csv: {
      filename: `${slug}.csv`,
      rows: rows.slice(0, 200).map((r) => ({
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
  const rows = input.data ?? [];
  const summary = rows.length ? input.summary || "Top opportunities" : "No significant changes found in this period";

  return {
    summary,
    sections: [
      {
        label: "Top Opportunities",
        items: limitItems(
          rows.map((r, idx) => ({
            primary: `${idx + 1}. ${r.query}`,
            meta: [
              `position ${r.position.toFixed(1)}`,
              `impressions ${formatCompact(r.impressions)}`,
              `page ${r.page ? shortenUrl(r.page) : "—"}`,
            ],
          })),
          5
        ),
      },
    ],
    csv: {
      filename: "opportunities.csv",
      rows: rows.slice(0, 200).map((r) => ({
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
  const rows = (input.data ?? []).slice().sort((a, b) => a.traffic_change - b.traffic_change);
  if (!rows.length) return { summary: "No significant changes found in this period", sections: [] };

  const top = rows[0];
  const rest = rows.slice(1);

  const summary = input.summary || `${rows.length} projects need attention`;

  return {
    summary,
    sections: [
      {
        label: "Most impacted",
        items: [
          {
            primary: `${top.project} (${formatSignedPercent(top.traffic_change)})`,
            meta: [`issue ${top.primary_issue}`],
          },
        ],
      },
      {
        label: "Also declining",
        items: limitItems(
          rest.map((r) => ({
            primary: `${r.project} (${formatSignedPercent(r.traffic_change)})`,
            meta: [`issue ${r.primary_issue}`],
          })),
          5
        ),
      },
    ],
    csv: {
      filename: "projects-attention.csv",
      rows: rows.slice(0, 200).map((r) => ({
        project: r.project,
        traffic_change: r.traffic_change,
        primary_issue: r.primary_issue,
      })),
    },
  };
}
