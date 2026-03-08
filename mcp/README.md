# Consoleviewer MCP v1

Read-only MCP server for exposing Consoleviewer SEO analytics over JSON-RPC 2.0.

## Tool List

- `list_tools`
- `get_site_overview`
- `get_query_opportunities`
- `get_recent_changes`
- `get_page_performance`
- `get_keyword_clusters`
- `explain_traffic_drop`
- `explain_traffic_change`
- `suggest_content`

All site-scoped tools accept:

```json
{
  "site": "<property-uuid-or-encoded-property-id>",
  "startDate": "2026-01-01",
  "endDate": "2026-01-28"
}
```

`startDate` and `endDate` are validated (YYYY-MM-DD) and ignored in v1; default snapshot windows are used.

## Security and Safeguards

- Session-authenticated using existing NextAuth flow.
- Property access validation per request (`-32003 Forbidden` on failure).
- In-memory rate limiting: 30 requests/minute/user (`-32002 Rate limit exceeded`).
- Read-only SQL helper (`SELECT`/`WITH` only).
- Parameterized SQL only.
- Request logging (timestamp, user, method, property).

## JSON-RPC Example (`suggest_content`)

```bash
curl -X POST http://localhost:3000/api/ai/mcp \
  -H "content-type: application/json" \
  -b "next-auth.session-token=SESSION" \
  -d '{
    "jsonrpc": "2.0",
    "id": "1",
    "method": "suggest_content",
    "params": { "site": "PROPERTY_ID" }
  }'
```

## JSON-RPC Example (`list_tools`)

```bash
curl -X POST http://localhost:3000/api/ai/mcp \
  -H "content-type: application/json" \
  -b "next-auth.session-token=SESSION" \
  -d '{
    "jsonrpc": "2.0",
    "id": "2",
    "method": "list_tools",
    "params": {}
  }'
```

## Standalone Local Testing

```bash
MCP_STANDALONE=1 MCP_TEST_USER_ID=<user_uuid> npx tsx mcp/server.ts
```

```bash
curl -s http://localhost:3334 \
  -H "content-type: application/json" \
  -d '{"jsonrpc":"2.0","id":"1","method":"get_query_opportunities","params":{"site":"PROPERTY_ID"}}'
```
