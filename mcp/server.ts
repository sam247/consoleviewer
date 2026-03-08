import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { getSessionUserId } from "@/lib/session";
import { checkRateLimit } from "@/mcp/middleware/rate-limit";
import { JSON_RPC_ERRORS, routeRpcRequest } from "@/mcp/router";
import type { RPCResponse } from "@/mcp/types";

function toJsonResponse(body: RPCResponse, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
      "cache-control": "no-store",
    },
  });
}

export async function handleMcpPayload(payload: unknown, userId: string | null): Promise<RPCResponse> {
  if (!userId) {
    return {
      jsonrpc: "2.0",
      id: null,
      error: JSON_RPC_ERRORS.UNAUTHORIZED,
    };
  }

  const rateLimit = checkRateLimit(userId);
  if (!rateLimit.ok) {
    return {
      jsonrpc: "2.0",
      id: null,
      error: {
        ...JSON_RPC_ERRORS.RATE_LIMIT,
        data: { retryAfterMs: rateLimit.retryAfterMs },
      },
    };
  }

  return routeRpcRequest(payload, { userId });
}

export async function createNextMcpHandler(request: Request): Promise<Response> {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return toJsonResponse(
      {
        jsonrpc: "2.0",
        id: null,
        error: JSON_RPC_ERRORS.PARSE_ERROR,
      },
      400
    );
  }

  const userId = await getSessionUserId();
  const result = await handleMcpPayload(payload, userId);
  return toJsonResponse(result, 200);
}

async function readNodeBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

async function handleNodeRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (req.method !== "POST") {
    res.writeHead(405, { "content-type": "application/json" });
    res.end(JSON.stringify({ jsonrpc: "2.0", id: null, error: { code: -32600, message: "Only POST is supported" } }));
    return;
  }

  let payload: unknown;
  try {
    const raw = await readNodeBody(req);
    payload = JSON.parse(raw);
  } catch {
    res.writeHead(400, { "content-type": "application/json" });
    res.end(JSON.stringify({ jsonrpc: "2.0", id: null, error: JSON_RPC_ERRORS.PARSE_ERROR }));
    return;
  }

  const headerUser = req.headers["x-mcp-user-id"];
  const userId = (Array.isArray(headerUser) ? headerUser[0] : headerUser) || process.env.MCP_TEST_USER_ID || null;

  const result = await handleMcpPayload(payload, userId);
  res.writeHead(200, {
    "content-type": "application/json",
    "cache-control": "no-store",
  });
  res.end(JSON.stringify(result));
}

export function startStandaloneMcpServer(port = Number(process.env.MCP_PORT || 3334)) {
  const server = createServer((req, res) => {
    void handleNodeRequest(req, res);
  });

  server.listen(port, () => {
    console.log(`[mcp] Consoleviewer MCP listening on http://localhost:${port}`);
  });

  return server;
}

if (process.env.MCP_STANDALONE === "1") {
  startStandaloneMcpServer();
}
