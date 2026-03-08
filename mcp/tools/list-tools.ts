import { validateListToolsParams } from "@/mcp/validation";
import type { ToolDefinition, ToolDescriptor } from "@/mcp/types";

export function createListToolsTool(
  getDescriptors: () => ToolDescriptor[]
): ToolDefinition<"list_tools"> {
  return {
    name: "list_tools",
    description: "List available MCP tools and their input schema.",
    inputSchema: {
      type: "object",
      properties: {},
      required: [],
      additionalProperties: false,
    },
    validate: validateListToolsParams,
    async handler() {
      return getDescriptors();
    },
  };
}
