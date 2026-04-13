import { readQuery } from "@/mcp/db";
import { buildRangeWindow, getLatestSnapshotDate, normalizeSiteLabel } from "@/mcp/shared";
import type { ProjectAttentionRow, ProjectsAttentionResult, ToolDefinition } from "@/mcp/types";
import { validateAnalyticsParams } from "@/mcp/validation";

type LatestRow = { max: string | null };

type AggRow = {
  property_id: string;
  site_url: string;
  gsc_site_url: string | null;
  clicks_cur: number;
  clicks_prev: number;
  impr_cur: number;
  impr_prev: number;
  pos_sum_cur: number;
  pos_sum_prev: number;
};

function pct(cur: number, prev: number) {
  if (!prev) return cur ? 100 : 0;
  return ((cur - prev) / prev) * 100;
}

function primaryIssue({
  clicksPct,
  imprPct,
  ctrPct,
  posDelta,
}: {
  clicksPct: number;
  imprPct: number;
  ctrPct: number;
  posDelta: number;
}) {
  if (imprPct <= -10) return "Visibility loss";
  if (ctrPct <= -5) return "CTR decline";
  if (posDelta >= 1.0) return "Rankings slipping";
  if (clicksPct <= -10) return "Traffic decline";
  return "Mixed decline";
}

export const getProjectsAttentionTool: ToolDefinition<"get_projects_attention"> = {
  name: "get_projects_attention",
  description: "Identify projects with declining clicks vs previous period.",
  inputSchema: {
    type: "object",
    properties: {
      scope: { type: "string", enum: ["project", "all_projects"] },
      project_id: { type: "string" },
      date_range: { type: "string", enum: ["last_7_days"] },
      compare: { type: "string", enum: ["previous_period"] },
    },
    required: ["scope", "date_range", "compare"],
    additionalProperties: false,
  },
  validate: validateAnalyticsParams,
  handler: async (input, context): Promise<ProjectsAttentionResult> => {
    const userId = context.userId;

    const propertyFilter =
      input.scope === "project" && context.validatedProperty?.propertyId
        ? { propertyId: context.validatedProperty.propertyId }
        : null;

    let latestDate: string | null = null;
    if (propertyFilter) {
      latestDate = await getLatestSnapshotDate(propertyFilter.propertyId);
    } else {
      const latest = await readQuery<LatestRow>(
        `WITH props AS (
           SELECT p.id
           FROM properties p
           JOIN team_members tm ON tm.team_id = p.team_id
           WHERE tm.user_id = $1 AND p.active = true
         )
         SELECT MAX(d.date)::text AS max
         FROM gsc_property_daily d
         JOIN props ON props.id = d.property_id`,
        [userId]
      );
      latestDate = latest.rows[0]?.max ?? null;
    }

    if (!latestDate) {
      return { summary: "No data available", data: [] };
    }

    const w = buildRangeWindow(latestDate, input.date_range);

    const agg = await readQuery<AggRow>(
      `WITH props AS (
         SELECT p.id AS property_id, p.site_url, p.gsc_site_url
         FROM properties p
         JOIN team_members tm ON tm.team_id = p.team_id
         WHERE tm.user_id = $1 AND p.active = true
         ${propertyFilter ? "AND p.id = $6" : ""}
       )
       SELECT
         props.property_id,
         props.site_url,
         props.gsc_site_url,
         SUM(CASE WHEN d.date BETWEEN $2 AND $3 THEN d.clicks ELSE 0 END)::float8 AS clicks_cur,
         SUM(CASE WHEN d.date BETWEEN $4 AND $5 THEN d.clicks ELSE 0 END)::float8 AS clicks_prev,
         SUM(CASE WHEN d.date BETWEEN $2 AND $3 THEN d.impressions ELSE 0 END)::float8 AS impr_cur,
         SUM(CASE WHEN d.date BETWEEN $4 AND $5 THEN d.impressions ELSE 0 END)::float8 AS impr_prev,
         SUM(CASE WHEN d.date BETWEEN $2 AND $3 THEN d.position_sum ELSE 0 END)::float8 AS pos_sum_cur,
         SUM(CASE WHEN d.date BETWEEN $4 AND $5 THEN d.position_sum ELSE 0 END)::float8 AS pos_sum_prev
       FROM props
       JOIN gsc_property_daily d ON d.property_id = props.property_id
       WHERE d.date BETWEEN $4 AND $3
       GROUP BY props.property_id, props.site_url, props.gsc_site_url`,
      propertyFilter
        ? [userId, w.currentStart, w.currentEnd, w.priorStart, w.priorEnd, propertyFilter.propertyId]
        : [userId, w.currentStart, w.currentEnd, w.priorStart, w.priorEnd]
    );

    const rows: ProjectAttentionRow[] = agg.rows
      .map((r) => {
        const clicksPct = pct(r.clicks_cur, r.clicks_prev);
        const imprPct = pct(r.impr_cur, r.impr_prev);
        const ctrCur = r.impr_cur ? (r.clicks_cur / r.impr_cur) * 100 : 0;
        const ctrPrev = r.impr_prev ? (r.clicks_prev / r.impr_prev) * 100 : 0;
        const ctrPct = pct(ctrCur, ctrPrev);
        const posCur = r.impr_cur ? r.pos_sum_cur / r.impr_cur : 0;
        const posPrev = r.impr_prev ? r.pos_sum_prev / r.impr_prev : 0;
        const posDelta = posCur - posPrev;

        return {
          project: normalizeSiteLabel(r.site_url, r.gsc_site_url),
          traffic_change: Math.round(clicksPct),
          primary_issue: primaryIssue({
            clicksPct,
            imprPct,
            ctrPct,
            posDelta,
          }),
        };
      })
      .filter((r) => r.traffic_change < 0)
      .sort((a, b) => a.traffic_change - b.traffic_change)
      .slice(0, 15);

    const summary = rows.length ? `${rows.length} projects need attention` : "No projects need attention";
    return { summary, data: rows };
  },
};

