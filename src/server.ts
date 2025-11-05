#!/usr/bin/env node

/**
 * GitLab MCP Server Entry Point
 * 🔒 READ-ONLY: This server only fetches data from GitLab (no write operations)
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { loadConfig } from "./utils/config.js";
import { createLogger, type Logger } from "./utils/logger.js";
import { registerGitLabTool } from "./tools/gitlab-mr-comments.js";

/**
 * Setup graceful shutdown handlers
 */
function setupShutdownHandlers(server: Server, logger: Logger): void {
  const cleanup = async () => {
    logger.info("Shutting down MCP server...");
    try {
      await server.close();
      logger.info("Server shut down successfully");
      process.exit(0);
    } catch (error) {
      logger.error("Error during shutdown", {
        error: error instanceof Error ? error.message : String(error),
      });
      process.exit(1);
    }
  };

  process.on("SIGINT", cleanup);
  process.on("SIGTERM", cleanup);
}

/**
 * Main server initialization
 */
async function main(): Promise<void> {
  try {
    // Load configuration from environment
    const config = loadConfig();
    const logger = createLogger(config);

    logger.info("Starting GitLab MCP Server", {
      version: "1.0.0",
      gitlabBaseUrl: config.gitlabBaseUrl,
      logLevel: config.logLevel,
    });

    // Create MCP server
    const server = new Server(
      {
        name: "gitlab-mr-comments",
        version: "1.0.0",
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    // Register the gitlab_get_mr_comments tool
    registerGitLabTool(server, config, logger);

    // Setup stdio transport
    const transport = new StdioServerTransport();
    await server.connect(transport);

    logger.info("MCP server connected and ready");

    // Setup graceful shutdown
    setupShutdownHandlers(server, logger);
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
}

// Handle unhandled rejections and exceptions
process.on("unhandledRejection", (reason) => {
  console.error("Unhandled rejection:", reason);
  process.exit(1);
});

process.on("uncaughtException", (error) => {
  console.error("Uncaught exception:", error);
  process.exit(1);
});

// Start the server
main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
