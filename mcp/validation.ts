import { z } from "zod";
import type { AnalyticsToolInput, ListToolsInput, SiteScopedToolInput, ToolName } from "@/mcp/types";

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

export const analyticsParamsSchema = z
  .object({
    scope: z.enum(["project", "all_projects"]),
    project_id: z.string().min(1).optional(),
    date_range: z.literal("last_7_days"),
    compare: z.literal("previous_period"),
  })
  .strict()
  .refine((x) => (x.scope === "project" ? Boolean(x.project_id) : true), {
    message: "project_id is required when scope is project",
    path: ["project_id"],
  });

export function validateSiteScopedParams(input: unknown): input is SiteScopedToolInput {
  return siteScopedParamsSchema.safeParse(input).success;
}

export function validateListToolsParams(input: unknown): input is ListToolsInput {
  if (input === undefined) return true;
  return listToolsParamsSchema.safeParse(input).success;
}

export function validateAnalyticsParams(input: unknown): input is AnalyticsToolInput {
  return analyticsParamsSchema.safeParse(input).success;
}

export function validateToolParams(method: ToolName, input: unknown): boolean {
  if (method === "list_tools") {
    return validateListToolsParams(input);
  }
  if (
    method === "get_movement_summary" ||
    method === "get_biggest_losers" ||
    method === "get_biggest_winners" ||
    method === "get_opportunities" ||
    method === "get_projects_attention" ||
    method === "get_404_pages"
  ) {
    return validateAnalyticsParams(input);
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

  if (
    method === "get_movement_summary" ||
    method === "get_biggest_losers" ||
    method === "get_biggest_winners" ||
    method === "get_opportunities" ||
    method === "get_projects_attention" ||
    method === "get_404_pages"
  ) {
    return {
      type: "object",
      properties: {
        scope: { type: "string", enum: ["project", "all_projects"] },
        project_id: { type: "string", description: "Consoleviewer property UUID or encoded property ID" },
        date_range: { type: "string", enum: ["last_7_days"] },
        compare: { type: "string", enum: ["previous_period"] },
      },
      required: ["scope", "date_range", "compare"],
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
