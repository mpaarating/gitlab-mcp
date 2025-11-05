#!/usr/bin/env node
/**
 * Generate JSON Schema from Zod schemas
 */

import { zodToJsonSchema } from "zod-to-json-schema";
import { GitLabToolOutputSchema } from "../src/types/schemas.js";
import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";

const schema = zodToJsonSchema(GitLabToolOutputSchema, {
  name: "GitLabMRCommentsResponse",
  $refStrategy: "none",
});

// Add metadata
const fullSchema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "https://raw.githubusercontent.com/mpaarating/gitlab-mcp/main/schemas/gitlab-mr-comments.schema.json",
  title: "GitLab MR Comments Response",
  description: "Schema for GitLab merge request comments response from the MCP server",
  ...schema,
};

// Ensure schemas directory exists
const schemasDir = join(process.cwd(), "schemas");
mkdirSync(schemasDir, { recursive: true });

const outputPath = join(schemasDir, "gitlab-mr-comments.schema.json");
writeFileSync(outputPath, JSON.stringify(fullSchema, null, 2));

console.log(`✅ JSON Schema generated at: ${outputPath}`);
