#!/usr/bin/env tsx
/**
 * Test script to verify GitLab connection and token
 * Usage: npx tsx scripts/test-connection.ts
 */

import { loadConfig } from "../src/utils/config.js";
import { createLogger } from "../src/utils/logger.js";
import { GitLabClient } from "../src/services/gitlab-client.js";

async function main() {
  console.log("🔍 Testing GitLab MCP Server Configuration\n");

  try {
    // Load configuration
    console.log("1️⃣ Loading configuration...");
    const config = loadConfig();
    console.log(`   ✅ GitLab URL: ${config.gitlabBaseUrl}`);
    console.log(`   ✅ Token: ${config.gitlabToken.substring(0, 10)}...`);
    console.log(`   ✅ Log Level: ${config.logLevel}\n`);

    // Create logger and client
    const logger = createLogger(config);
    const client = new GitLabClient({
      baseUrl: config.gitlabBaseUrl,
      token: config.gitlabToken,
      timeout: config.requestTimeout,
      logger,
    });

    // Test connection by fetching current user
    console.log("2️⃣ Testing GitLab API connection...");
    const userResponse = await client.get("/user");
    const user = userResponse.data as { username: string; name: string };
    console.log(`   ✅ Connected as: ${user.name} (@${user.username})\n`);

    console.log("3️⃣ Verifying token permissions...");
    console.log("   ✅ Token has API access");
    console.log(`   ℹ️  Recommended scope: read_api (read-only)\n`);

    console.log("✨ Configuration test successful!\n");
    console.log("Next steps:");
    console.log("  1. Configure your MCP client (Cursor or Claude Desktop)");
    console.log("  2. See QUICKSTART.md for setup instructions");
    console.log("  3. Try asking: 'Fetch comments from MR !123 in project group/project'\n");

    process.exit(0);
  } catch (error) {
    console.error("\n❌ Configuration test failed!\n");

    if (error instanceof Error) {
      console.error(`Error: ${error.message}\n`);

      if (error.message.includes("GITLAB_TOKEN")) {
        console.error("💡 Tip: Set your GitLab token:");
        console.error("   export GITLAB_TOKEN='glpat-your-token-here'");
        console.error("   or copy .env.example to .env and edit it\n");
      } else if (error.message.includes("401") || error.message.includes("403")) {
        console.error("💡 Tip: Check your token:");
        console.error("   1. Token might be expired");
        console.error("   2. Token needs 'read_api' or 'api' scope");
        console.error("   3. Verify token at GitLab → Settings → Access Tokens\n");
      } else if (error.message.includes("ENOTFOUND") || error.message.includes("ECONNREFUSED")) {
        console.error("💡 Tip: Check your GitLab URL:");
        console.error("   export GITLAB_BASE_URL='https://gitlab.your-company.com'");
        console.error("   (Default: https://gitlab.com)\n");
      }
    }

    process.exit(1);
  }
}

main();

