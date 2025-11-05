/**
 * GitLab MR Comments Tool Handler
 * Orchestrates fetching, normalization, filtering, and formatting of MR comments
 */

import { zodToJsonSchema } from "zod-to-json-schema";
import type { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { GitLabToolInputSchema, type GitLabToolOutput } from "../types/schemas.js";
import { fetchAllDiscussions } from "../services/discussions.js";
import { fetchAllNotes } from "../services/notes.js";
import { normalizeComments } from "../processors/normalizer.js";
import { applyFilters } from "../processors/filter.js";
import { generateMarkdown } from "../processors/markdown.js";
import { mapToMcpError } from "../utils/errors.js";
import type { Config } from "../utils/config.js";
import type { Logger } from "../utils/logger.js";
import { randomUUID } from "crypto";

/**
 * Generate a correlation ID for request tracing
 */
function generateCorrelationId(): string {
  return randomUUID();
}

/**
 * Register the gitlab_get_mr_comments tool with the MCP server
 */
export function registerGitLabTool(server: Server, config: Config, logger: Logger): void {
  // Register tool listing
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        {
          name: "gitlab_get_mr_comments",
          description:
            "Fetch comments from a GitLab merge request. " +
            "Returns inline discussions and overview notes in a structured format. " +
            "Supports filtering by resolution status and excluding system notes. " +
            "Useful for AI agents to review feedback and plan code fixes.",
          inputSchema: zodToJsonSchema(GitLabToolInputSchema, "GitLabToolInput"),
        },
      ],
    };
  });

  // Register tool execution handler
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    if (request.params.name !== "gitlab_get_mr_comments") {
      throw new Error(`Unknown tool: ${request.params.name}`);
    }

    const correlationId = generateCorrelationId();
    logger.info("Tool invoked", {
      tool: "gitlab_get_mr_comments",
      correlationId,
      arguments: request.params.arguments,
    });

    try {
      // Validate and parse arguments
      const args = GitLabToolInputSchema.parse(request.params.arguments);

      // Fetch discussions and notes in parallel
      const [discussions, notes] = await Promise.all([
        fetchAllDiscussions(
          {
            project: args.project,
            mr: args.mr,
            perPage: args.perPage,
          },
          config,
          logger,
          correlationId
        ),
        args.includeOverviewNotes
          ? fetchAllNotes(
              {
                project: args.project,
                mr: args.mr,
                perPage: args.perPage,
              },
              config,
              logger,
              correlationId
            )
          : Promise.resolve([]),
      ]);

      // Normalize into unified Comment structure
      const normalized = normalizeComments(discussions, notes);

      // Apply filters and sorting
      const filtered = applyFilters(normalized, {
        includeSystem: args.includeSystem,
        onlyResolved: args.onlyResolved,
        onlyUnresolved: args.onlyUnresolved,
      });

      // Generate optional Markdown digest
      const markdown =
        args.format === "markdown"
          ? generateMarkdown(filtered, {
              project: args.project,
              mr: args.mr,
            })
          : undefined;

      // Construct response
      const response: GitLabToolOutput = {
        project: args.project,
        mr: args.mr,
        fetchedAt: new Date().toISOString(),
        counts: {
          comments: filtered.length,
          discussions: discussions.length,
          notes: notes.length,
        },
        comments: filtered,
        markdown,
      };

      logger.info("Tool completed successfully", {
        correlationId,
        counts: response.counts,
      });

      // Return formatted response
      const content =
        args.format === "markdown" && markdown ? markdown : JSON.stringify(response, null, 2);

      return {
        content: [
          {
            type: "text",
            text: content,
          },
        ],
      };
    } catch (error) {
      logger.error("Tool execution failed", {
        correlationId,
        error: error instanceof Error ? error.message : String(error),
      });

      // Map to MCP-compatible error with remediation hints
      throw mapToMcpError(error);
    }
  });

  logger.info("GitLab MR Comments tool registered successfully");
}
