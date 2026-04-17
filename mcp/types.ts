export type JsonRpcId = string | number | null;

export type ToolName =
  | "list_tools"
  | "get_site_overview"
  | "get_query_opportunities"
  | "get_recent_changes"
  | "get_page_performance"
  | "get_keyword_clusters"
  | "explain_traffic_drop"
  | "explain_traffic_change"
  | "suggest_content"
  | "get_movement_summary"
  | "get_biggest_losers"
  | "get_biggest_winners"
  | "get_opportunities"
  | "get_projects_attention"
  | "get_404_pages";

export type SiteScopedToolInput = {
  site: string;
  startDate?: string;
  endDate?: string;
};

export type ListToolsInput = Record<string, never> | undefined;

export type AnalyticsScope = "project" | "all_projects";
export type AnalyticsDateRange = "last_7_days";
export type AnalyticsCompareMode = "previous_period";

export type AnalyticsToolInput = {
  scope: AnalyticsScope;
  project_id?: string;
  date_range: AnalyticsDateRange;
  compare: AnalyticsCompareMode;
};

export type ToolInputMap = {
  list_tools: ListToolsInput;
  get_site_overview: SiteScopedToolInput;
  get_query_opportunities: SiteScopedToolInput;
  get_recent_changes: SiteScopedToolInput;
  get_page_performance: SiteScopedToolInput;
  get_keyword_clusters: SiteScopedToolInput;
  explain_traffic_drop: SiteScopedToolInput;
  explain_traffic_change: SiteScopedToolInput;
  suggest_content: SiteScopedToolInput;
  get_movement_summary: AnalyticsToolInput;
  get_biggest_losers: AnalyticsToolInput;
  get_biggest_winners: AnalyticsToolInput;
  get_opportunities: AnalyticsToolInput;
  get_projects_attention: AnalyticsToolInput;
  get_404_pages: AnalyticsToolInput;
};

export type MovementRow = {
  query: string;
  clicks_change: number;
  position_from: number;
  position_to: number;
  page: string | null;
};

export type MovementSummaryResult = {
  summary: string;
  declines: MovementRow[];
  gains: MovementRow[];
};

export type BiggestChangesResult = {
  summary: string;
  data: MovementRow[];
};

export type OpportunityRow = {
  query: string;
  position: number;
  impressions: number;
  ctr: number;
  page: string | null;
};

export type OpportunitiesResult = {
  summary: string;
  data: OpportunityRow[];
};

export type ProjectAttentionRow = {
  project: string;
  traffic_change: number;
  primary_issue: string;
};

export type ProjectsAttentionResult = {
  summary: string;
  data: ProjectAttentionRow[];
};

export type NotFoundPageRow = {
  page: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
  clicks_change: number;
  impressions_change: number;
};

export type NotFoundPagesResult = {
  summary: string;
  data: NotFoundPageRow[];
};

export type SiteOverviewItem = {
  query?: string;
  url?: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
};

export type SiteOverviewResult = {
  site: string;
  clicks: number;
  impressions: number;
  ctr: number;
  avg_position: number;
  visibility_score: number;
  top_queries: SiteOverviewItem[];
  top_pages: SiteOverviewItem[];
};

export type QueryOpportunityRow = {
  query: string;
  impressions: number;
  position: number;
  ctr: number;
  opportunity_score: number;
};

export type RecentChangeItem = {
  query: string;
  previous_position: number;
  current_position: number;
  impressions_change: number;
  clicks_change: number;
};

export type RecentChangesResult = {
  gains: RecentChangeItem[];
  losses: RecentChangeItem[];
  new_rankings: RecentChangeItem[];
  dropped_rankings: RecentChangeItem[];
};

export type PagePerformanceRow = {
  url: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
  change: number;
};

export type KeywordClusterRow = {
  cluster: string;
  queries: string[];
  total_impressions: number;
  avg_position: number;
};

export type TrafficDropCause = {
  type: string;
  impact: number;
  confidence: number;
  detail: string;
};

export type TrafficDropQueryLoss = {
  query: string;
  clicks_change: number;
  impressions_change: number;
  position_change: number;
};

export type TrafficDropPageLoss = {
  url: string;
  clicks_change: number;
  impressions_change: number;
  position_change: number;
};

export type TrafficDropExplanationResult = {
  site: string;
  summary: string;
  period: {
    current_start: string;
    current_end: string;
    prior_start: string;
    prior_end: string;
  };
  metrics: {
    clicks_change: number;
    impressions_change: number;
    ctr_change: number;
    position_change: number;
  };
  likely_causes: TrafficDropCause[];
  top_losing_queries: TrafficDropQueryLoss[];
  top_losing_pages: TrafficDropPageLoss[];
};

export type TrafficChangeDriver = {
  query: string;
  previous_position: number;
  current_position: number;
  click_change: number;
};

export type TrafficChangeExplanationResult = {
  summary: string;
  drivers: TrafficChangeDriver[];
};

export type SuggestedContentRecommendation = {
  topic: string;
  search_demand: number;
  current_rank: number;
  opportunity_score: number;
  recommended_content_type: string;
};

export type SuggestedContentResult = {
  recommendations: SuggestedContentRecommendation[];
};

export type ToolDescriptor = {
  name: ToolName;
  description: string;
  input_schema: Record<string, unknown>;
};

export type ToolResponseMap = {
  list_tools: ToolDescriptor[];
  get_site_overview: SiteOverviewResult;
  get_query_opportunities: QueryOpportunityRow[];
  get_recent_changes: RecentChangesResult;
  get_page_performance: PagePerformanceRow[];
  get_keyword_clusters: KeywordClusterRow[];
  explain_traffic_drop: TrafficDropExplanationResult;
  explain_traffic_change: TrafficChangeExplanationResult;
  suggest_content: SuggestedContentResult;
  get_movement_summary: MovementSummaryResult;
  get_biggest_losers: BiggestChangesResult;
  get_biggest_winners: BiggestChangesResult;
  get_opportunities: OpportunitiesResult;
  get_projects_attention: ProjectsAttentionResult;
  get_404_pages: NotFoundPagesResult;
};

export type ToolResponse = ToolResponseMap[ToolName];

export type JSONSchemaLike = {
  type: string;
  properties?: Record<string, unknown>;
  required?: string[];
  additionalProperties?: boolean;
};

export type ValidatedProperty = {
  propertyId: string;
  teamId: string;
  siteUrl: string;
  gscSiteUrl: string | null;
  requestedSite: string;
};

export type ToolContext = {
  userId: string;
  validatedProperty?: ValidatedProperty;
};

export type ToolDefinition<Name extends ToolName = ToolName> = {
  name: Name;
  description: string;
  inputSchema: JSONSchemaLike;
  validate: (input: unknown) => input is ToolInputMap[Name];
  handler: (input: ToolInputMap[Name], context: ToolContext) => Promise<ToolResponseMap[Name]>;
};

export type RPCRequest = {
  jsonrpc: "2.0";
  id: JsonRpcId;
  method: ToolName;
  params?: unknown;
};

export type RPCError = {
  code: number;
  message: string;
  data?: unknown;
};

export type RPCSuccessResponse = {
  jsonrpc: "2.0";
  id: JsonRpcId;
  result: ToolResponse;
};

export type RPCErrorResponse = {
  jsonrpc: "2.0";
  id: JsonRpcId;
  error: RPCError;
};

export type RPCResponse = RPCSuccessResponse | RPCErrorResponse;
