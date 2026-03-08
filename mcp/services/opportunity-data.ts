import { readQuery } from "@/mcp/db";

export type OpportunitySourceRow = {
  query_text: string;
  score: number;
  impressions: number;
  clicks: number;
  position_sum: number;
};

export async function fetchOpportunitySourceRows(propertyId: string, latestDate: string): Promise<OpportunitySourceRow[]> {
  const res = await readQuery<OpportunitySourceRow>(
    `SELECT q.query_text, o.score, o.impressions, o.clicks, o.position_sum
     FROM opportunity_queries o
     JOIN query_dictionary q ON q.id = o.query_id
     WHERE o.property_id = $1 AND o.date = $2::date
     ORDER BY o.score DESC
     LIMIT 200`,
    [propertyId, latestDate]
  );

  return res.rows;
}
