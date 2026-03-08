import { z } from "zod";
import type { ListToolsInput, SiteScopedToolInput, ToolName } from "@/mcp/types";

const isoDateRegex = /^\d{4}-\d{2}-\d{2}$/;

const optionalDate = z
  .string()
  .regex(isoDateRegex, "Expected date format YYYY-MM-DD")
  .optional();

export const siteScopedParamsSchema = z
  .object({
    site: z.string().min(1, "site is required"),
    startDate: optionalDate,
    endDate: optionalDate,
  })
  .strict();

export const listToolsParamsSchema = z.object({}).strict();

export function validateSiteScopedParams(input: unknown): input is SiteScopedToolInput {
  return siteScopedParamsSchema.safeParse(input).success;
}

export function validateListToolsParams(input: unknown): input is ListToolsInput {
  if (input === undefined) return true;
  return listToolsParamsSchema.safeParse(input).success;
}

export function validateToolParams(method: ToolName, input: unknown): boolean {
  if (method === "list_tools") {
    return validateListToolsParams(input);
  }
  return validateSiteScopedParams(input);
}

export function getInputSchemaForMethod(method: ToolName): Record<string, unknown> {
  if (method === "list_tools") {
    return {
      type: "object",
      properties: {},
      required: [],
      additionalProperties: false,
    };
  }

  return {
    type: "object",
    properties: {
      site: { type: "string", description: "Consoleviewer property UUID or encoded property ID" },
      startDate: { type: "string", description: "Optional YYYY-MM-DD (validated, ignored in v1)" },
      endDate: { type: "string", description: "Optional YYYY-MM-DD (validated, ignored in v1)" },
    },
    required: ["site"],
    additionalProperties: false,
  };
}
