import { createNextMcpHandler } from "@/mcp/server";

export async function POST(request: Request): Promise<Response> {
  return createNextMcpHandler(request);
}
