import type {
  BiggestChangesResult,
  MovementSummaryResult,
  OpportunitiesResult,
  ProjectsAttentionResult,
  ToolName,
} from "@/mcp/types";

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

export function shapeMcpResponse(method: ToolName, result: unknown): string {
  switch (method) {
    case "get_movement_summary":
      return shapeMovementSummary(result as MovementSummaryResult);
    case "get_biggest_losers":
      return shapeRankedChanges("Biggest losers", result as BiggestChangesResult);
    case "get_biggest_winners":
      return shapeRankedChanges("Biggest winners", result as BiggestChangesResult);
    case "get_opportunities":
      return shapeOpportunities(result as OpportunitiesResult);
    case "get_projects_attention":
      return shapeProjectsAttention(result as ProjectsAttentionResult);
    default:
      return "No response formatter for this tool.";
  }
}

function shapeMovementSummary(input: MovementSummaryResult): string {
  const lines: string[] = [];
  lines.push(input.summary || "Movement summary");

  const declines = input.declines?.slice(0, 8) ?? [];
  const gains = input.gains?.slice(0, 8) ?? [];

  lines.push("");
  lines.push("↓ Declines:");
  if (!declines.length) {
    lines.push("- None");
  } else {
    for (const r of declines) {
      lines.push(
        `- ${r.query} (pos ${formatPosChange(r.position_from, r.position_to)}, clicks ${formatClicksChange(r.clicks_change)})`
      );
    }
  }

  lines.push("");
  lines.push("↑ Gains:");
  if (!gains.length) {
    lines.push("- None");
  } else {
    for (const r of gains) {
      lines.push(
        `- ${r.query} (pos ${formatPosChange(r.position_from, r.position_to)}, clicks ${formatClicksChange(r.clicks_change)})`
      );
    }
  }

  return lines.join("\n");
}

function shapeRankedChanges(title: string, input: BiggestChangesResult): string {
  const lines: string[] = [];
  lines.push(input.summary || title);
  lines.push("");

  const rows = input.data?.slice(0, 10) ?? [];
  if (!rows.length) {
    lines.push("No rows.");
    return lines.join("\n");
  }

  rows.forEach((r, idx) => {
    const page = r.page ? shortenUrl(r.page) : "—";
    lines.push(`${idx + 1}. ${r.query}`);
    lines.push(`   • clicks: ${formatClicksChange(r.clicks_change)}`);
    lines.push(`   • position: ${formatPosChange(r.position_from, r.position_to)}`);
    lines.push(`   • page: ${page}`);
  });

  return lines.join("\n");
}

function shapeOpportunities(input: OpportunitiesResult): string {
  const lines: string[] = [];
  lines.push(input.summary || "Top opportunities");
  lines.push("");

  const rows = input.data?.slice(0, 10) ?? [];
  if (!rows.length) {
    lines.push("No opportunities found.");
    return lines.join("\n");
  }

  lines.push("Top Opportunities:");
  rows.forEach((r, idx) => {
    const page = r.page ? shortenUrl(r.page) : "—";
    lines.push(`${idx + 1}. ${r.query}`);
    lines.push(`   • position: ${r.position.toFixed(1)}`);
    lines.push(`   • impressions: ${formatCompact(r.impressions)}`);
    lines.push(`   • page: ${page}`);
  });

  return lines.join("\n");
}

function shapeProjectsAttention(input: ProjectsAttentionResult): string {
  const lines: string[] = [];
  lines.push(input.summary || "Projects needing attention");
  lines.push("");

  const rows = input.data?.slice(0, 10) ?? [];
  if (!rows.length) {
    lines.push("No projects flagged.");
    return lines.join("\n");
  }

  lines.push("Projects Needing Attention:");
  rows.forEach((r, idx) => {
    lines.push(`${idx + 1}. ${r.project}`);
    lines.push(`   • traffic change: ${formatSignedPercent(r.traffic_change)}`);
    lines.push(`   • issue: ${r.primary_issue}`);
  });

  return lines.join("\n");
}
