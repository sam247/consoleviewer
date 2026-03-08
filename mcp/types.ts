export type JsonRpcId = string | number | null;

export type ToolName =
  | "get_site_overview"
  | "get_query_opportunities"
  | "get_recent_changes"
  | "get_page_performance"
  | "get_keyword_clusters";

export type ToolInput = {
  site: string;
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

export type ToolResponseMap = {
  get_site_overview: SiteOverviewResult;
  get_query_opportunities: QueryOpportunityRow[];
  get_recent_changes: RecentChangesResult;
  get_page_performance: PagePerformanceRow[];
  get_keyword_clusters: KeywordClusterRow[];
};

export type ToolResponse = ToolResponseMap[ToolName];

export type JSONSchemaLike = {
  type: "object";
  properties: {
    site: {
      type: "string";
      description?: string;
    };
  };
  required: ["site"];
  additionalProperties: false;
};

export type ToolContext = {
  userId: string;
};

export type ToolDefinition<Name extends ToolName = ToolName> = {
  name: Name;
  description: string;
  inputSchema: JSONSchemaLike;
  validate: (input: unknown) => input is ToolInput;
  handler: (input: ToolInput, context: ToolContext) => Promise<ToolResponseMap[Name]>;
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
