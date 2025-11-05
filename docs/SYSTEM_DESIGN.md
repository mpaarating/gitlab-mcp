# GitLab MCP Server - System and Component Design

**Version**: 1.0  
**Date**: 2025-11-05  
**Status**: Implementation-Ready

---

## Table of Contents

1. [System Architecture Overview](#1-system-architecture-overview)
2. [Component Design](#2-component-design)
3. [Module Structure](#3-module-structure)
4. [Interface Specifications](#4-interface-specifications)
5. [Data Flow](#5-data-flow)
6. [Error Handling Strategy](#6-error-handling-strategy)
7. [Performance Considerations](#7-performance-considerations)
8. [Security Architecture](#8-security-architecture)
9. [Testing Architecture](#9-testing-architecture)
10. [Implementation Roadmap](#10-implementation-roadmap)

---

## 1) System Architecture Overview

### 1.0 Primary Use Case: Agent-Driven Code Review Remediation

**🎯 Core Workflow: Enabling coding agents to seamlessly process reviewer feedback and fix code**

**Typical Agent Workflow:**

```
┌─────────────────────────────────────────────────────────────┐
│  1. Developer pushes code → Creates MR → Requests review    │
└────────────────────┬────────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────────┐
│  2. Reviewers add comments:                                 │
│     • Inline discussions on specific code lines             │
│     • Overview notes about architecture/approach            │
│     • Suggestions for improvements                          │
└────────────────────┬────────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────────┐
│  3. Developer invokes AI agent (Cursor/Claude) to help      │
│     "Review all unresolved comments on MR !123"             │
└────────────────────┬────────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────────┐
│  4. Agent uses gitlab_get_mr_comments tool:                 │
│     { project: "my-org/repo", mr: 123,                      │
│       onlyUnresolved: true, includeSystem: false }          │
└────────────────────┬────────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────────┐
│  5. Agent receives structured feedback:                     │
│     • Comment body (what needs fixing)                      │
│     • File path (where to fix)                              │
│     • Line position (exact location)                        │
│     • Author context (who suggested)                        │
│     • Thread context (related discussion)                   │
└────────────────────┬────────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────────┐
│  6. Agent analyzes feedback and generates fix plan:         │
│     • Group by file_path                                    │
│     • Prioritize by resolvable status                       │
│     • Read affected code files                              │
│     • Generate targeted diffs                               │
└────────────────────┬────────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────────┐
│  7. Agent applies fixes:                                    │
│     • Edits files based on reviewer feedback                │
│     • Commits changes                                       │
│     • (Human reviews before pushing)                        │
└─────────────────────────────────────────────────────────────┘
```

**Why This Design Supports The Workflow:**

1. **Structured Output**: Comments normalized into agent-friendly JSON (no manual parsing)
2. **File Path Extraction**: `file_path` field lets agents immediately know which files to edit
3. **Thread Context**: `thread_id` groups related comments for holistic understanding
4. **Resolution Filtering**: `onlyUnresolved: true` shows only actionable feedback
5. **System Note Filtering**: `includeSystem: false` removes noise (merge events, CI status)
6. **Chronological Ordering**: Comments sorted by time for understanding discussion evolution
7. **Markdown Digest**: Human-readable summary for developer review before applying changes

**Example Agent Prompts Enabled:**

- _"Fetch all unresolved comments from MR !456 and create a fix plan"_
- _"What feedback did reviewers leave on src/api/users.ts?"_
- _"Summarize the discussion on MR !789 and show blocking issues"_
- _"Apply fixes for all comments mentioning 'error handling'"_

---

### 1.1 Read-Only Architecture Guarantee

**🔒 CRITICAL: This is a READ-ONLY system. No write operations are permitted.**

**Enforced safeguards:**

1. **HTTP Method Restriction**: GitLab client only supports `GET` requests
2. **API Scope**: Recommended token scope is `read_api` (read-only)
3. **Tool Contract**: Tool definition explicitly states "fetch" / "retrieve" (no create/update/delete)
4. **Code Review**: Any PR introducing write methods (POST/PUT/PATCH/DELETE) must be rejected
5. **Integration Tests**: Verify no mutation endpoints are called

**GitLab API endpoints used (all read-only):**

- ✅ `GET /projects/:id/merge_requests/:iid/discussions` (read discussions)
- ✅ `GET /projects/:id/merge_requests/:iid/notes` (read notes)
- ❌ NO POST/PUT/PATCH/DELETE endpoints

**Why this matters:**

- Prevents accidental modification of MR state (comments, resolutions, labels)
- Ensures agents can safely query without side effects
- Agents read feedback, humans commit fixes (maintains accountability)
- Maintains audit trail integrity (no write operations to attribute)

---

### 1.2 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    AI Agent (Cursor/Claude)                 │
│                                                             │
│  Uses MCP protocol to request GitLab MR comment data       │
└──────────────────────┬──────────────────────────────────────┘
                       │ stdio (MCP Protocol)
                       │
┌──────────────────────▼──────────────────────────────────────┐
│                   MCP SERVER LAYER                          │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Server Entry Point (server.ts)                     │   │
│  │  - MCP protocol handling                            │   │
│  │  - Tool registration                                │   │
│  │  - Request routing                                  │   │
│  └────────────────────┬────────────────────────────────┘   │
│                       │                                     │
│  ┌────────────────────▼────────────────────────────────┐   │
│  │  Tool Handler (tools/gitlab-mr-comments.ts)         │   │
│  │  - Input validation (Zod)                           │   │
│  │  - Orchestration logic                              │   │
│  │  - Output formatting                                │   │
│  └────────────────────┬────────────────────────────────┘   │
└───────────────────────┼─────────────────────────────────────┘
                        │
┌───────────────────────▼─────────────────────────────────────┐
│                  SERVICE LAYER                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  GitLab API Client (services/gitlab-client.ts)       │  │
│  │  - HTTP client wrapper (undici)                      │  │
│  │  - Auth header management                            │  │
│  │  - Base URL configuration                            │  │
│  │  - Request/response logging                          │  │
│  └──────────────────────┬───────────────────────────────┘  │
│                         │                                   │
│  ┌──────────────────────▼───────────────────────────────┐  │
│  │  Discussion Fetcher (services/discussions.ts)        │  │
│  │  - Paginated discussion retrieval                    │  │
│  │  - Retry logic with backoff                          │  │
│  │  - Rate limit handling                               │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Notes Fetcher (services/notes.ts)                   │  │
│  │  - Paginated note retrieval                          │  │
│  │  - Retry logic with backoff                          │  │
│  │  - Rate limit handling                               │  │
│  └──────────────────────────────────────────────────────┘  │
└───────────────────────┼─────────────────────────────────────┘
                        │
┌───────────────────────▼─────────────────────────────────────┐
│                PROCESSING LAYER                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Comment Normalizer (processors/normalizer.ts)       │  │
│  │  - Discussion → Comment transformation               │  │
│  │  - Note → Comment transformation                     │  │
│  │  - Position parsing & file path extraction           │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Comment Filter (processors/filter.ts)               │  │
│  │  - System note filtering                             │  │
│  │  - Resolution status filtering                       │  │
│  │  - Chronological sorting                             │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Markdown Generator (processors/markdown.ts)         │  │
│  │  - Human-readable digest creation                    │  │
│  │  - Thread grouping                                   │  │
│  │  - Metadata formatting                               │  │
│  └──────────────────────────────────────────────────────┘  │
└───────────────────────┼─────────────────────────────────────┘
                        │
┌───────────────────────▼─────────────────────────────────────┐
│              UTILITIES & CROSS-CUTTING                      │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Logger (utils/logger.ts)                            │  │
│  │  - Structured logging with correlation IDs           │  │
│  │  - Secret redaction                                  │  │
│  │  - Log levels (INFO, WARN, ERROR)                    │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Configuration (utils/config.ts)                     │  │
│  │  - Environment variable loading                      │  │
│  │  - Default values                                    │  │
│  │  - Validation                                        │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Error Mapper (utils/errors.ts)                      │  │
│  │  - HTTP error → MCP error transformation             │  │
│  │  - Remediation hints                                 │  │
│  │  - Error categorization                              │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Types & Schemas (types/, schemas/)                  │  │
│  │  - Zod schemas for validation                        │  │
│  │  - TypeScript interfaces                             │  │
│  │  - JSON Schema exports                               │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                        │
                        │ HTTPS
                        │
┌───────────────────────▼─────────────────────────────────────┐
│               GitLab REST API                               │
│  - /projects/:id/merge_requests/:iid/discussions            │
│  - /projects/:id/merge_requests/:iid/notes                  │
└─────────────────────────────────────────────────────────────┘
```

### 1.3 Design Principles

1. **Separation of Concerns**: Clear boundaries between MCP handling, GitLab API interaction, and data processing
2. **Single Responsibility**: Each component has one well-defined purpose
3. **Dependency Injection**: Services receive dependencies (logger, config) for testability
4. **Fail Fast**: Validate inputs early; surface errors with actionable messages
5. **Defensive Programming**: Handle edge cases, malformed API responses, and network issues
6. **Observability First**: Structured logging with correlation IDs throughout
7. **Immutability**: Prefer pure functions; avoid stateful components where possible

### 1.4 Technology Stack

| Layer           | Technology                  | Rationale                                   |
| --------------- | --------------------------- | ------------------------------------------- |
| **Runtime**     | Node.js ≥18                 | Async/await, native fetch, stable LTS       |
| **Language**    | TypeScript 5.x              | Type safety, better DX, compile-time errors |
| **MCP SDK**     | `@modelcontextprotocol/sdk` | Official MCP implementation                 |
| **HTTP Client** | `undici`                    | Fast, modern, Node.js native                |
| **Validation**  | `zod`                       | Runtime type checking, schema generation    |
| **Build**       | `tsc`                       | Standard TypeScript compiler, zero config   |
| **Testing**     | `vitest`                    | Fast, TypeScript-native, ESM support        |
| **Linting**     | `eslint` + `prettier`       | Code quality and consistency                |

---

## 2) Agent Integration Patterns

### 2.1 Optimal Agent Workflow for Code Remediation

**Step-by-Step Agent Process:**

**1. Fetch Actionable Feedback**

```typescript
// Agent calls the tool with filters to get only what needs fixing
{
  "tool": "gitlab_get_mr_comments",
  "arguments": {
    "project": "my-org/backend-api",
    "mr": 456,
    "onlyUnresolved": true,    // Only show unresolved comments
    "includeSystem": false,     // Hide system noise
    "format": "json"            // Structured data for processing
  }
}
```

**2. Parse and Group Comments by File**

```typescript
// Agent logic to organize feedback
const commentsByFile = comments.reduce((acc, comment) => {
  const file = comment.file_path || "general";
  if (!acc[file]) acc[file] = [];
  acc[file].push(comment);
  return acc;
}, {});

// Example output:
// {
//   "src/api/users.ts": [
//     { note_id: 123, body: "Add error handling...", line: 45 },
//     { note_id: 124, body: "Extract to helper...", line: 78 }
//   ],
//   "src/db/schema.ts": [
//     { note_id: 125, body: "Add index here", line: 12 }
//   ],
//   "general": [
//     { note_id: 126, body: "Update README with new API" }
//   ]
// }
```

**3. Prioritize Comments**

```typescript
// Agent determines priority based on:
// - Resolvable comments (blocking) vs general notes
// - Number of comments per file (high activity = important)
// - Thread depth (discussion threads = complex issues)
// - Keywords: "bug", "security", "breaking", "must", "blocker"

const prioritized = Object.entries(commentsByFile)
  .map(([file, comments]) => ({
    file,
    comments,
    priority: calculatePriority(comments),
    hasBlockers: comments.some(
      (c) =>
        c.body.toLowerCase().includes("blocker") ||
        c.body.toLowerCase().includes("must fix")
    ),
  }))
  .sort((a, b) => b.priority - a.priority);
```

**4. Generate Fix Plan**

```typescript
// Agent creates human-readable plan for approval
const fixPlan = prioritized.map(({ file, comments }) => {
  return {
    file,
    changes: comments.map((c) => ({
      location: c.file_path ? `Line ${c.position?.new_line || "?"}` : "General",
      feedback: c.body,
      author: c.author?.username,
      action: inferAction(c.body), // e.g., "refactor", "add-test", "fix-bug"
    })),
  };
});

// Present to developer:
// "I found 8 unresolved comments across 3 files. Here's my fix plan:
//
// 1. src/api/users.ts (3 comments)
//    - Line 45: Add error handling (by @reviewer1) → fix-bug
//    - Line 78: Extract to helper (by @reviewer1) → refactor
//    - Line 92: Add input validation (by @reviewer2) → fix-bug
//
// 2. src/db/schema.ts (1 comment)
//    - Line 12: Add index (by @dba-reviewer) → performance
//
// Shall I proceed with these fixes?"
```

**5. Apply Fixes with Context**

```typescript
// For each file with comments:
for (const { file, comments } of prioritized) {
  // Agent reads the file
  const fileContent = await readFile(file);

  // Agent considers ALL comments for that file together
  // (to avoid conflicting changes)
  const updatedContent = applyFixesIntelligently(
    fileContent,
    comments,
    // Agent uses thread_id to group related discussions
    groupByThread(comments)
  );

  // Agent shows diff to human
  // Human approves/rejects before writing
}
```

**6. Human Review Gate**

```
Agent: "I've prepared fixes for 8 comments. Review changes?
  ✓ src/api/users.ts (+15 lines, -8 lines)
  ✓ src/db/schema.ts (+2 lines)
  ✓ README.md (+10 lines)

Show diffs? [y/n]"

Developer: "y"

[Agent shows diffs]

Developer: "Apply changes"

[Agent writes files, commits with message:]
"fix: address MR !456 review comments

- Add error handling to user API endpoints
- Extract validation to helper function
- Add database index for performance
- Update README with API changes

Addresses comments from @reviewer1, @reviewer2, @dba-reviewer"
```

### 2.2 Agent Query Patterns

**Pattern 1: Initial Review Triage**

```typescript
// Get overview of all feedback
{
  "project": "my-org/repo",
  "mr": 123,
  "format": "markdown"  // Human-readable summary
}
// Agent presents markdown to developer for quick scan
```

**Pattern 2: Focus on Unresolved Only**

```typescript
// Get actionable items
{
  "project": "my-org/repo",
  "mr": 123,
  "onlyUnresolved": true,
  "includeSystem": false
}
// Agent builds fix plan from structured data
```

**Pattern 3: File-Specific Queries**

```typescript
// Agent fetches all comments, then filters client-side
const allComments = await fetchComments({ project, mr });
const fileComments = allComments.comments.filter(
  (c) => c.file_path === "src/api/users.ts"
);
// Useful when working on one file at a time
```

**Pattern 4: Thread Analysis**

```typescript
// Group comments by thread to understand discussions
const threads = {};
comments.forEach((c) => {
  if (c.thread_id) {
    if (!threads[c.thread_id]) threads[c.thread_id] = [];
    threads[c.thread_id].push(c);
  }
});

// Each thread shows evolution of discussion:
// Thread abc123:
//   - @dev: "Should I use a helper here?"
//   - @reviewer: "Yes, extract to utils/validation.ts"
//   - @dev: "Done, thanks!"
// Agent understands full context, not just last comment
```

### 2.3 Output Optimization for Agents

**Why JSON is the Default:**

- Programmatic access to structured fields
- Easy filtering, grouping, sorting
- Type-safe parsing with Zod schemas
- Machine-readable for LLM context

**When to Use Markdown:**

- Initial human review (developer scans before agent acts)
- Summary reports ("Here's what needs fixing...")
- Presenting feedback to developer for approval
- Logging/documentation purposes

**Critical Fields for Agents:**

| Field               | Agent Use Case                                    |
| ------------------- | ------------------------------------------------- |
| `file_path`         | Know which file to edit                           |
| `position.new_line` | Know which line to modify                         |
| `body`              | Understand what to fix                            |
| `thread_id`         | Group related discussions                         |
| `resolved`          | Determine if actionable                           |
| `author.username`   | Context on who suggested (seniority/expertise)    |
| `created_at`        | Understand timeline (latest feedback is freshest) |
| `resolvable`        | Distinguish blocking issues from notes            |

### 2.4 Example: Complete Agent Implementation

```typescript
async function handleMergeRequestReview(
  mrUrl: string // "https://gitlab.com/my-org/repo/-/merge_requests/123"
) {
  // 1. Parse MR URL
  const { project, mr } = parseMrUrl(mrUrl);

  // 2. Fetch unresolved comments
  const result = await callTool("gitlab_get_mr_comments", {
    project,
    mr,
    onlyUnresolved: true,
    includeSystem: false,
  });

  // 3. Analyze feedback
  const { comments, counts } = result;

  if (counts.comments === 0) {
    return "✅ No unresolved comments! Ready to merge.";
  }

  // 4. Group by file
  const byFile = groupByFile(comments);

  // 5. Generate plan
  const plan = await generateFixPlan(byFile);

  // 6. Show to developer
  console.log(
    `Found ${counts.comments} unresolved comments across ${
      Object.keys(byFile).length
    } files.`
  );
  console.log("\nProposed fixes:");
  plan.forEach((item, i) => {
    console.log(`\n${i + 1}. ${item.file}`);
    item.changes.forEach((change) => {
      console.log(`   - ${change.location}: ${change.feedback}`);
    });
  });

  // 7. Get approval
  const approved = await askHuman("Apply these fixes? [y/n]");

  if (!approved) {
    return "Cancelled. No changes made.";
  }

  // 8. Apply fixes
  for (const item of plan) {
    await applyFixesToFile(item.file, item.changes);
  }

  // 9. Commit
  await gitCommit(
    `fix: address MR !${mr} review feedback\n\nResolved ${counts.comments} comments.`
  );

  return `✅ Applied fixes for ${counts.comments} comments. Review and push when ready.`;
}
```

---

## 3) Component Design

### 3.1 MCP Server Layer

#### **Component**: `Server Entry Point`

**File**: `src/server.ts`

**Responsibilities**:

- Initialize MCP server with stdio transport
- Register the `gitlab_get_mr_comments` tool
- Set up global error handlers
- Initialize logger and configuration
- Handle graceful shutdown

**Key Dependencies**:

- `@modelcontextprotocol/sdk` → Server, StdioServerTransport
- `./utils/config` → loadConfig()
- `./utils/logger` → createLogger()
- `./tools/gitlab-mr-comments` → registerGitLabTool()

**Pseudo-Interface**:

```typescript
async function main(): Promise<void> {
  const config = loadConfig();
  const logger = createLogger(config);

  const server = new Server(
    { name: "gitlab-mr-comments", version: "1.0.0" },
    { capabilities: { tools: {} } }
  );

  registerGitLabTool(server, config, logger);

  const transport = new StdioServerTransport();
  await server.connect(transport);

  setupShutdownHandlers(server, logger);
}
```

**Error Handling**:

- Catch unhandled rejections/exceptions → log and exit gracefully
- On SIGINT/SIGTERM → flush logs, close connections, exit(0)

---

#### **Component**: `Tool Handler`

**File**: `src/tools/gitlab-mr-comments.ts`

**Responsibilities**:

- Define tool schema (name, description, input schema)
- Validate tool arguments using Zod
- Orchestrate fetching discussions and notes
- Coordinate normalization, filtering, and formatting
- Return MCP tool response

**Key Dependencies**:

- `zod` → Input validation
- `../services/discussions` → fetchAllDiscussions()
- `../services/notes` → fetchAllNotes()
- `../processors/normalizer` → normalizeComments()
- `../processors/filter` → applyFilters()
- `../processors/markdown` → generateMarkdown()

**Pseudo-Interface**:

```typescript
export function registerGitLabTool(
  server: Server,
  config: Config,
  logger: Logger
): void {
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      {
        name: "gitlab_get_mr_comments",
        description: "Fetch comments from GitLab MR...",
        inputSchema: zodToJsonSchema(GitLabToolInputSchema),
      },
    ],
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const args = GitLabToolInputSchema.parse(request.params.arguments);
    const correlationId = generateCorrelationId();

    logger.info("Tool invoked", { correlationId, args });

    try {
      const [discussions, notes] = await Promise.all([
        fetchAllDiscussions(args, config, logger, correlationId),
        args.includeOverviewNotes
          ? fetchAllNotes(args, config, logger, correlationId)
          : Promise.resolve([]),
      ]);

      const normalized = normalizeComments(discussions, notes);
      const filtered = applyFilters(normalized, args);
      const markdown =
        args.format === "markdown"
          ? generateMarkdown(filtered, args)
          : undefined;

      const response = {
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

      logger.info("Tool completed", { correlationId, counts: response.counts });

      return {
        content: [{ type: "text", text: JSON.stringify(response, null, 2) }],
      };
    } catch (error) {
      logger.error("Tool failed", { correlationId, error });
      throw mapToMcpError(error);
    }
  });
}
```

**Validation Rules**:

- `project`: non-empty string
- `mr`: positive integer or string convertible to int
- `perPage`: 1-100 (default 100)
- `onlyResolved` and `onlyUnresolved`: mutually exclusive
- `format`: 'json' | 'markdown' (default 'json')

---

### 3.2 Service Layer

#### **Component**: `GitLab API Client`

**File**: `src/services/gitlab-client.ts`

**Responsibilities**:

- Provide a low-level HTTP wrapper for GitLab API
- **ENFORCE READ-ONLY: Only support GET requests**
- Inject auth headers (`PRIVATE-TOKEN`)
- Handle base URL resolution (GitLab.com vs self-managed)
- Parse pagination headers (`X-Next-Page`, `X-Total-Pages`)
- Apply request timeouts (20s per request)
- Log requests/responses (without sensitive data)

**Key Dependencies**:

- `undici` → fetch
- `../utils/config` → Config
- `../utils/logger` → Logger

**Interface**:

```typescript
export interface GitLabClientOptions {
  baseUrl: string;
  token: string;
  timeout?: number;
  logger: Logger;
}

export interface PaginationInfo {
  nextPage: number | null;
  totalPages: number | null;
  perPage: number;
  total: number | null;
}

export class GitLabClient {
  constructor(private options: GitLabClientOptions);

  /**
   * READ-ONLY: Perform GET request to GitLab API
   * @throws Error if attempting to use write methods
   */
  async get<T>(
    path: string,
    queryParams?: Record<string, string | number>,
    correlationId?: string
  ): Promise<{ data: T; pagination: PaginationInfo }>;

  /**
   * READ-ONLY: Fetch all pages using GET requests
   * @throws Error if attempting to use write methods
   */
  async getAllPages<T>(
    path: string,
    queryParams?: Record<string, string | number>,
    correlationId?: string
  ): Promise<T[]>;

  // 🔒 DELIBERATELY OMITTED: post(), put(), patch(), delete()
  // This class ONLY supports GET requests to prevent accidental writes
}
```

**Implementation Notes**:

- Use `undici` fetch with `AbortController` for timeouts
- **ONLY implement `GET` method - no post/put/patch/delete methods**
- Parse `X-Next-Page` header to determine pagination
- Redact `PRIVATE-TOKEN` in logs
- Throw typed errors: `GitLabAuthError`, `GitLabNotFoundError`, `GitLabRateLimitError`, etc.

**Read-Only Enforcement**:

```typescript
// EXAMPLE: Explicit method restriction in implementation
async get<T>(path: string, ...): Promise<...> {
  const url = new URL(path, this.options.baseUrl);

  const response = await fetch(url, {
    method: 'GET', // ✅ ONLY GET allowed
    headers: {
      'PRIVATE-TOKEN': this.options.token,
      'Content-Type': 'application/json'
    },
    signal: AbortSignal.timeout(this.options.timeout ?? 20000)
  });

  // ... handle response
}

// 🚫 NO implementation for:
// - post()
// - put()
// - patch()
// - delete()
```

---

#### **Component**: `Discussion Fetcher`

**File**: `src/services/discussions.ts`

**Responsibilities**:

- Fetch all discussions for a given MR
- Handle pagination transparently
- Apply retry logic with exponential backoff for 429/5xx
- Return normalized array of GitLab discussion objects

**Key Dependencies**:

- `./gitlab-client` → GitLabClient
- `../utils/retry` → retryWithBackoff()

**Interface**:

```typescript
export interface FetchDiscussionsOptions {
  project: string;
  mr: number;
  perPage: number;
}

export async function fetchAllDiscussions(
  options: FetchDiscussionsOptions,
  config: Config,
  logger: Logger,
  correlationId: string
): Promise<GitLabDiscussion[]>;
```

**Implementation Strategy**:

1. Construct endpoint: `/projects/${encodeURIComponent(project)}/merge_requests/${mr}/discussions`
2. Call `client.getAllPages()` with `per_page` param
3. Wrap in `retryWithBackoff()` for transient errors
4. Log progress: "Fetching discussions page X of Y"
5. Return flat array of discussions

---

#### **Component**: `Notes Fetcher`

**File**: `src/services/notes.ts`

**Responsibilities**:

- Fetch all overview notes for a given MR
- Handle pagination transparently
- Apply retry logic with exponential backoff
- Return normalized array of GitLab note objects

**Interface**:

```typescript
export interface FetchNotesOptions {
  project: string;
  mr: number;
  perPage: number;
}

export async function fetchAllNotes(
  options: FetchNotesOptions,
  config: Config,
  logger: Logger,
  correlationId: string
): Promise<GitLabNote[]>;
```

**Implementation Strategy**:

- Similar to `fetchAllDiscussions`, but endpoint: `/projects/${project}/merge_requests/${mr}/notes`
- Use same retry and pagination logic

---

### 3.3 Processing Layer

#### **Component**: `Comment Normalizer`

**File**: `src/processors/normalizer.ts`

**Responsibilities**:

- Transform GitLab `Discussion` objects into `Comment[]`
- Transform GitLab `Note` objects into `Comment[]`
- Extract `file_path` from `position` object
- Flatten discussion threads (preserve order)
- Ensure all required fields are present

**Interface**:

```typescript
export interface Comment {
  source: "discussion" | "note";
  thread_id: string | null;
  note_id: number;
  author: {
    id: number;
    username: string;
    name: string;
  } | null;
  body: string;
  created_at: string;
  updated_at: string | null;
  system: boolean;
  resolvable: boolean;
  resolved: boolean | null;
  resolved_by: {
    id: number;
    username: string;
    name: string;
  } | null;
  position: object | null;
  file_path: string | null;
}

export function normalizeComments(
  discussions: GitLabDiscussion[],
  notes: GitLabNote[]
): Comment[];
```

**Transformation Logic**:

**Discussion → Comment[]**:

```typescript
function normalizeDiscussion(discussion: GitLabDiscussion): Comment[] {
  return discussion.notes.map((note) => ({
    source: "discussion",
    thread_id: discussion.id,
    note_id: note.id,
    author: note.author
      ? {
          id: note.author.id,
          username: note.author.username,
          name: note.author.name,
        }
      : null,
    body: note.body,
    created_at: note.created_at,
    updated_at: note.updated_at ?? null,
    system: note.system ?? false,
    resolvable: note.resolvable ?? false,
    resolved: note.resolved ?? null,
    resolved_by: note.resolved_by
      ? {
          id: note.resolved_by.id,
          username: note.resolved_by.username,
          name: note.resolved_by.name,
        }
      : null,
    position: note.position ?? null,
    file_path: extractFilePath(note.position),
  }));
}
```

**Note → Comment**:

```typescript
function normalizeNote(note: GitLabNote): Comment {
  return {
    source: "note",
    thread_id: null,
    note_id: note.id,
    author: note.author
      ? {
          id: note.author.id,
          username: note.author.username,
          name: note.author.name,
        }
      : null,
    body: note.body,
    created_at: note.created_at,
    updated_at: note.updated_at ?? null,
    system: note.system ?? false,
    resolvable: false,
    resolved: null,
    resolved_by: null,
    position: null,
    file_path: null,
  };
}
```

**File Path Extraction**:

```typescript
function extractFilePath(position: any): string | null {
  if (!position) return null;
  return position.new_path ?? position.old_path ?? null;
}
```

---

#### **Component**: `Comment Filter`

**File**: `src/processors/filter.ts`

**Responsibilities**:

- Filter out system notes if `includeSystem: false`
- Filter by resolution status (`onlyResolved`, `onlyUnresolved`)
- Sort comments chronologically by `created_at`
- Handle filter precedence and validation

**Interface**:

```typescript
export interface FilterOptions {
  includeSystem: boolean;
  onlyResolved: boolean;
  onlyUnresolved: boolean;
}

export function applyFilters(
  comments: Comment[],
  options: FilterOptions
): Comment[];
```

**Filtering Logic**:

```typescript
export function applyFilters(
  comments: Comment[],
  options: FilterOptions
): Comment[] {
  let filtered = [...comments];

  // Filter system notes
  if (!options.includeSystem) {
    filtered = filtered.filter((c) => !c.system);
  }

  // Filter by resolution status
  if (options.onlyUnresolved) {
    filtered = filtered.filter((c) => c.resolvable && c.resolved === false);
  } else if (options.onlyResolved) {
    filtered = filtered.filter((c) => c.resolvable && c.resolved === true);
  }

  // Sort chronologically
  filtered.sort(
    (a, b) =>
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

  return filtered;
}
```

---

#### **Component**: `Markdown Generator`

**File**: `src/processors/markdown.ts`

**Responsibilities**:

- Generate human-readable Markdown digest
- Group comments by thread (discussions) and standalone notes
- Include metadata: author, timestamp, file path
- Format body content (preserve markdown)

**Interface**:

```typescript
export interface MarkdownOptions {
  project: string;
  mr: number;
}

export function generateMarkdown(
  comments: Comment[],
  options: MarkdownOptions
): string;
```

**Template**:

```markdown
# GitLab MR !{mr} comments for {project}

Fetched: {ISO timestamp}
Total comments: {count}

---

## Discussion: {thread_id} ({file_path})

**@{username}** • {timestamp} • {resolved status}

{body}

---

## Overview Notes

**@{username}** • {timestamp}

{body}

---
```

**Implementation Notes**:

- Group comments by `thread_id`
- Separate discussions from standalone notes
- Truncate long bodies (optional, for readability)
- Include resolution status for resolvable comments

---

### 3.4 Utilities & Cross-Cutting

#### **Component**: `Logger`

**File**: `src/utils/logger.ts`

**Responsibilities**:

- Provide structured logging (JSON output)
- Support log levels: DEBUG, INFO, WARN, ERROR
- Inject correlation IDs into all log entries
- Redact secrets (tokens, API keys)
- Optionally log request/response payloads (dev mode)

**Interface**:

```typescript
export interface Logger {
  debug(message: string, meta?: Record<string, any>): void;
  info(message: string, meta?: Record<string, any>): void;
  warn(message: string, meta?: Record<string, any>): void;
  error(message: string, meta?: Record<string, any>): void;
}

export function createLogger(config: Config): Logger;
```

**Implementation**:

```typescript
export function createLogger(config: Config): Logger {
  const logLevel = config.logLevel ?? "INFO";

  function log(level: string, message: string, meta?: Record<string, any>) {
    const entry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...redactSecrets(meta),
    };
    console.error(JSON.stringify(entry)); // stderr for logging
  }

  return {
    debug: (msg, meta) => logLevel === "DEBUG" && log("DEBUG", msg, meta),
    info: (msg, meta) => log("INFO", msg, meta),
    warn: (msg, meta) => log("WARN", msg, meta),
    error: (msg, meta) => log("ERROR", msg, meta),
  };
}

function redactSecrets(meta: any): any {
  // Recursively redact fields like 'token', 'password', 'PRIVATE-TOKEN'
  // Replace with '[REDACTED]'
}
```

---

#### **Component**: `Configuration`

**File**: `src/utils/config.ts`

**Responsibilities**:

- Load environment variables
- Provide default values
- Validate required fields (e.g., `GITLAB_TOKEN`)
- Export typed config object

**Interface**:

```typescript
export interface Config {
  gitlabBaseUrl: string;
  gitlabToken: string;
  logLevel: "DEBUG" | "INFO" | "WARN" | "ERROR";
  requestTimeout: number;
  maxRetries: number;
  logPayloads: boolean;
}

export function loadConfig(): Config;
```

**Implementation**:

```typescript
export function loadConfig(): Config {
  const token = process.env.GITLAB_TOKEN;
  if (!token) {
    throw new Error("GITLAB_TOKEN environment variable is required");
  }

  return {
    gitlabBaseUrl: process.env.GITLAB_BASE_URL ?? "https://gitlab.com",
    gitlabToken: token,
    logLevel: (process.env.LOG_LEVEL as any) ?? "INFO",
    requestTimeout: parseInt(process.env.REQUEST_TIMEOUT ?? "20000", 10),
    maxRetries: parseInt(process.env.MAX_RETRIES ?? "3", 10),
    logPayloads: process.env.LOG_PAYLOADS === "true",
  };
}
```

---

#### **Component**: `Error Mapper`

**File**: `src/utils/errors.ts`

**Responsibilities**:

- Transform HTTP/GitLab errors into MCP-compatible errors
- Add remediation hints for common issues
- Categorize errors (auth, not found, rate limit, transient)

**Interface**:

```typescript
export class GitLabError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode?: number,
    public remediation?: string
  ) {
    super(message);
  }
}

export function mapToMcpError(error: unknown): Error;
```

**Error Mapping**:

```typescript
export function mapToMcpError(error: unknown): Error {
  if (error instanceof GitLabError) {
    return new Error(
      `${error.message}${
        error.remediation ? "\n\nSuggestion: " + error.remediation : ""
      }`
    );
  }

  if (error instanceof Response) {
    const status = error.status;

    if (status === 401 || status === 403) {
      return new Error(
        "Authentication failed. Ensure GITLAB_TOKEN is set with read_api or api scope."
      );
    }

    if (status === 404) {
      return new Error(
        'Project or MR not found. Verify project path (e.g., "group/project") and MR IID (!123).'
      );
    }

    if (status === 429) {
      return new Error("Rate limit exceeded. Wait a moment and try again.");
    }

    if (status >= 500) {
      return new Error(
        "GitLab API is experiencing issues. Try again later or check status.gitlab.com."
      );
    }
  }

  return new Error("An unexpected error occurred: " + String(error));
}
```

---

#### **Component**: `Retry Logic`

**File**: `src/utils/retry.ts`

**Responsibilities**:

- Implement exponential backoff with jitter
- Retry on transient errors (429, 5xx)
- Max retry attempts configurable
- Log retry attempts

**Interface**:

```typescript
export interface RetryOptions {
  maxAttempts: number;
  baseDelay: number;
  maxDelay: number;
  logger: Logger;
  correlationId?: string;
}

export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: RetryOptions
): Promise<T>;
```

**Implementation**:

```typescript
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: RetryOptions
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= options.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      if (!isRetryable(error) || attempt === options.maxAttempts) {
        throw error;
      }

      const delay = calculateBackoff(
        attempt,
        options.baseDelay,
        options.maxDelay
      );
      options.logger.warn("Retrying request", {
        attempt,
        delay,
        correlationId: options.correlationId,
      });

      await sleep(delay);
    }
  }

  throw lastError;
}

function isRetryable(error: unknown): boolean {
  if (error instanceof Response) {
    return error.status === 429 || error.status >= 500;
  }
  return false;
}

function calculateBackoff(attempt: number, base: number, max: number): number {
  const exponential = Math.min(base * Math.pow(2, attempt - 1), max);
  const jitter = exponential * 0.1 * Math.random();
  return exponential + jitter;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
```

---

## 4) Module Structure

```
gitlab-mcp/
├── src/
│   ├── server.ts                    # MCP server entry point
│   ├── tools/
│   │   └── gitlab-mr-comments.ts    # Tool handler & orchestration
│   ├── services/
│   │   ├── gitlab-client.ts         # HTTP client wrapper
│   │   ├── discussions.ts           # Discussion fetcher
│   │   └── notes.ts                 # Notes fetcher
│   ├── processors/
│   │   ├── normalizer.ts            # Comment normalization
│   │   ├── filter.ts                # Filtering & sorting
│   │   └── markdown.ts              # Markdown generation
│   ├── utils/
│   │   ├── logger.ts                # Structured logging
│   │   ├── config.ts                # Environment config
│   │   ├── errors.ts                # Error mapping
│   │   └── retry.ts                 # Retry logic with backoff
│   └── types/
│       ├── gitlab.ts                # GitLab API types
│       ├── comment.ts               # Comment model types
│       └── schemas.ts               # Zod schemas
├── schemas/
│   └── gitlab-mr-comments.schema.json  # JSON Schema (public)
├── examples/
│   ├── request.json
│   ├── response.json
│   └── response.md
├── tests/
│   ├── unit/
│   │   ├── normalizer.test.ts
│   │   ├── filter.test.ts
│   │   └── markdown.test.ts
│   ├── integration/
│   │   ├── gitlab-client.test.ts
│   │   └── tool-handler.test.ts
│   └── fixtures/
│       ├── discussion-response.json
│       └── notes-response.json
├── dist/                            # Build output
├── docs/
│   ├── PRD.md                       # Product requirements
│   ├── SYSTEM_DESIGN.md             # This document
│   └── API.md                       # Tool API reference
├── .github/
│   └── workflows/
│       └── ci.yml                   # CI pipeline
├── tsconfig.json
├── package.json
├── LICENSE
├── README.md
└── .editorconfig
```

---

## 5) Interface Specifications

### 5.1 Tool Input Schema (Zod)

```typescript
import { z } from "zod";

export const GitLabToolInputSchema = z
  .object({
    project: z.string().min(1, "Project is required"),
    mr: z
      .union([z.number().int().positive(), z.string().regex(/^\d+$/)])
      .transform((val) => (typeof val === "string" ? parseInt(val, 10) : val)),
    includeSystem: z.boolean().default(false),
    includeOverviewNotes: z.boolean().default(true),
    onlyResolved: z.boolean().default(false),
    onlyUnresolved: z.boolean().default(false),
    perPage: z.number().int().min(1).max(100).default(100),
    format: z.enum(["json", "markdown"]).default("json"),
  })
  .refine((data) => !(data.onlyResolved && data.onlyUnresolved), {
    message: "Cannot set both onlyResolved and onlyUnresolved",
  });

export type GitLabToolInput = z.infer<typeof GitLabToolInputSchema>;
```

### 5.2 Tool Output Schema (Zod)

```typescript
export const CommentSchema = z.object({
  source: z.enum(["discussion", "note"]),
  thread_id: z.string().nullable(),
  note_id: z.number(),
  author: z
    .object({
      id: z.number(),
      username: z.string(),
      name: z.string(),
    })
    .nullable(),
  body: z.string(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime().nullable(),
  system: z.boolean(),
  resolvable: z.boolean(),
  resolved: z.boolean().nullable(),
  resolved_by: z
    .object({
      id: z.number(),
      username: z.string(),
      name: z.string(),
    })
    .nullable(),
  position: z.record(z.any()).nullable(),
  file_path: z.string().nullable(),
});

export const GitLabToolOutputSchema = z.object({
  project: z.string(),
  mr: z.number(),
  fetchedAt: z.string().datetime(),
  counts: z.object({
    comments: z.number(),
    discussions: z.number(),
    notes: z.number(),
  }),
  comments: z.array(CommentSchema),
  markdown: z.string().optional(),
});

export type Comment = z.infer<typeof CommentSchema>;
export type GitLabToolOutput = z.infer<typeof GitLabToolOutputSchema>;
```

### 5.3 GitLab API Types

```typescript
// Minimal GitLab API types (extend as needed)

export interface GitLabUser {
  id: number;
  username: string;
  name: string;
  avatar_url?: string;
}

export interface GitLabPosition {
  base_sha?: string;
  start_sha?: string;
  head_sha?: string;
  old_path?: string;
  new_path?: string;
  position_type?: string;
  old_line?: number | null;
  new_line?: number | null;
}

export interface GitLabNote {
  id: number;
  type?: string;
  body: string;
  attachment?: any;
  author: GitLabUser;
  created_at: string;
  updated_at?: string;
  system: boolean;
  noteable_id: number;
  noteable_type: string;
  noteable_iid?: number;
  resolvable?: boolean;
  resolved?: boolean;
  resolved_by?: GitLabUser;
  resolved_at?: string;
  confidential?: boolean;
  internal?: boolean;
  position?: GitLabPosition;
}

export interface GitLabDiscussion {
  id: string;
  individual_note: boolean;
  notes: GitLabNote[];
}
```

---

## 6) Data Flow

### 6.1 Request Flow Diagram

```
Agent sends MCP request
         ↓
[1] Server receives CallToolRequest
         ↓
[2] Tool Handler validates input (Zod)
         ↓
[3] Generate correlation ID
         ↓
[4] Parallel fetch:
    ├─→ fetchAllDiscussions()
    │    ├─→ GitLabClient.getAllPages('/discussions')
    │    │    ├─→ Paginate: GET page 1, 2, ..., N
    │    │    └─→ Retry on 429/5xx
    │    └─→ Return GitLabDiscussion[]
    │
    └─→ fetchAllNotes() (if includeOverviewNotes)
         ├─→ GitLabClient.getAllPages('/notes')
         │    ├─→ Paginate: GET page 1, 2, ..., N
         │    └─→ Retry on 429/5xx
         └─→ Return GitLabNote[]
         ↓
[5] normalizeComments(discussions, notes)
    ├─→ Flatten discussions into Comment[]
    ├─→ Transform notes into Comment[]
    └─→ Extract file_path from position
         ↓
[6] applyFilters(comments, options)
    ├─→ Filter system notes
    ├─→ Filter by resolution status
    └─→ Sort chronologically
         ↓
[7] generateMarkdown(filtered, options) (if format='markdown')
         ↓
[8] Construct output envelope:
    {
      project, mr, fetchedAt,
      counts: { comments, discussions, notes },
      comments: Comment[],
      markdown?: string
    }
         ↓
[9] Validate output (Zod)
         ↓
[10] Return MCP tool response
         ↓
Agent receives JSON/Markdown
```

### 6.2 Error Flow

```
Error occurs at any step
         ↓
Catch in tool handler try/catch
         ↓
mapToMcpError(error)
    ├─→ Auth error (401/403) → "Authentication failed..."
    ├─→ Not found (404) → "Project or MR not found..."
    ├─→ Rate limit (429) → "Rate limit exceeded..."
    ├─→ Server error (5xx) → "GitLab API issues..."
    └─→ Other → "Unexpected error..."
         ↓
Log error with correlation ID
         ↓
Return MCP error response with remediation hint
         ↓
Agent displays error message to user
```

---

## 7) Error Handling Strategy

### 7.1 Error Categories

| Category          | HTTP Status     | Handling                | User Message                                                             |
| ----------------- | --------------- | ----------------------- | ------------------------------------------------------------------------ |
| **Auth**          | 401, 403        | Fail immediately        | "Authentication failed. Ensure GITLAB_TOKEN with read_api or api scope." |
| **Not Found**     | 404             | Fail immediately        | "Project or MR not found. Verify project path and MR IID (!123)."        |
| **Rate Limit**    | 429             | Retry with backoff (3x) | "Rate limit exceeded. Wait and try again."                               |
| **Server Error**  | 5xx             | Retry with backoff (3x) | "GitLab API experiencing issues. Try again later."                       |
| **Timeout**       | Network timeout | Retry with backoff (3x) | "Request timed out. Check network or try again."                         |
| **Invalid Input** | N/A (Zod)       | Fail immediately        | "Invalid input: {field} {error}"                                         |
| **Unknown**       | Other           | Fail immediately        | "Unexpected error: {message}"                                            |

### 7.2 Retry Policy

- **Retryable errors**: 429, 5xx, network timeouts
- **Max attempts**: 3 (configurable via `MAX_RETRIES`)
- **Backoff**: Exponential with jitter
  - Attempt 1: 1s + jitter
  - Attempt 2: 2s + jitter
  - Attempt 3: 4s + jitter
- **Max delay**: 10s

### 7.3 Graceful Degradation

- If pagination fails mid-fetch, log partial results but fail the tool call
- No caching or partial responses (fail-fast to ensure data consistency)

---

## 8) Performance Considerations

### 8.1 Performance Targets

| Metric              | Target | Notes                                          |
| ------------------- | ------ | ---------------------------------------------- |
| **p50 latency**     | ≤ 2s   | For ≤ 500 comments, GitLab.com, US region      |
| **p95 latency**     | ≤ 5s   | For ≤ 500 comments                             |
| **Max payload**     | ~10MB  | Rough estimate for 1000 comments with metadata |
| **Request timeout** | 20s    | Per HTTP request                               |
| **Total timeout**   | 60s    | Entire tool call (agent-side)                  |

### 8.2 Optimization Strategies

1. **Parallel fetching**: Fetch discussions and notes concurrently using `Promise.all`
2. **Pagination**: Use max `per_page=100` to minimize roundtrips
3. **HTTP/2**: Use `undici` for connection reuse and multiplexing
4. **Filtering early**: Apply filters as early as possible (future: server-side filters if GitLab API supports)
5. **Streaming** (future): Stream comments as they're fetched (requires MCP protocol support)

### 8.3 Scalability Limits

- **Very large MRs** (>1000 comments): May exceed latency targets; recommend `onlyUnresolved` filter
- **Rate limits**: GitLab.com free tier = 300 req/min; self-managed varies
- **Memory**: Entire payload held in memory; ~1KB per comment = 1MB for 1000 comments (acceptable)

---

## 9) Security Architecture

### 9.0 Read-Only Security Guarantee

**🔒 CRITICAL: This system is designed to be READ-ONLY by default with multiple enforcement layers.**

**Enforcement Layers:**

| Layer                    | Mechanism                         | Protection                             |
| ------------------------ | --------------------------------- | -------------------------------------- |
| **1. Token Scope**       | Require `read_api` scope          | GitLab enforces read-only at API level |
| **2. Client Design**     | Only implement GET methods        | No code path for write operations      |
| **3. API Surface**       | No write endpoints exposed        | Only `/discussions` and `/notes` (GET) |
| **4. Tool Contract**     | MCP tool description says "fetch" | User/agent intent is read-only         |
| **5. Integration Tests** | Assert no mutation calls          | CI fails if write endpoints detected   |

**Token Scope Recommendation:**

```bash
# ✅ RECOMMENDED: Read-only API access
GITLAB_TOKEN=glpat_xxx  # Created with 'read_api' scope

# ⚠️  NOT RECOMMENDED: Full API access (includes write permissions)
GITLAB_TOKEN=glpat_yyy  # Created with 'api' scope (avoid unless necessary)
```

**Code-Level Protection:**

```typescript
// GitLabClient class ONLY exposes read methods:
class GitLabClient {
  async get<T>(...): Promise<...>      // ✅ Implemented
  async getAllPages<T>(...): Promise<...> // ✅ Implemented

  // 🚫 NEVER implement these:
  // async post<T>(...): Promise<...>
  // async put<T>(...): Promise<...>
  // async patch<T>(...): Promise<...>
  // async delete<T>(...): Promise<...>
}
```

**Integration Test Example:**

```typescript
describe("Read-Only Enforcement", () => {
  it("should only make GET requests", () => {
    const mockFetch = vi.fn();
    // ... mock setup ...

    await toolHandler({ project: "test", mr: 1 });

    // Assert: All fetch calls used GET method
    mockFetch.mock.calls.forEach((call) => {
      expect(call[1].method).toBe("GET");
    });
  });

  it("should reject if write methods are added", () => {
    const client = new GitLabClient(config);

    // These methods should not exist
    expect(client).not.toHaveProperty("post");
    expect(client).not.toHaveProperty("put");
    expect(client).not.toHaveProperty("patch");
    expect(client).not.toHaveProperty("delete");
  });
});
```

---

### 9.1 Secret Management

- **Token storage**: Environment variable (`GITLAB_TOKEN`)
- **Token transmission**: HTTPS only; `PRIVATE-TOKEN` header
- **Token logging**: NEVER log token values; redact in all logs
- **Token scope**: Recommend `read_api` (least privilege); `api` works but includes write permissions

### 9.2 Data Privacy

- **No persistence**: All data processed in-memory; no disk writes
- **No caching**: Fresh fetch every tool call
- **No external services**: Direct GitLab API calls only
- **Payload logging**: OFF by default; enable with `LOG_PAYLOADS=true` (dev only)

### 9.3 TLS/HTTPS

- **GitLab.com**: Trusted CA, HTTPS enforced
- **Self-managed**: Document custom CA setup if needed (Node.js `NODE_EXTRA_CA_CERTS`)

### 9.4 Input Validation

- **Injection prevention**: URL-encode `project` path; validate `mr` as integer
- **Schema validation**: Zod schemas enforce type safety
- **Error messages**: Sanitize; avoid leaking internal paths or stack traces to agent

---

## 10) Testing Architecture

### 10.1 Unit Tests (Vitest)

**Coverage targets**: >80% for processing/utils layers

**Key test files**:

- `tests/unit/normalizer.test.ts`

  - Test `Discussion` → `Comment[]` transformation
  - Test `Note` → `Comment` transformation
  - Test file path extraction from various `position` shapes
  - Edge cases: missing fields, null values

- `tests/unit/filter.test.ts`

  - Test system note filtering
  - Test resolution status filtering (`onlyResolved`, `onlyUnresolved`)
  - Test chronological sorting
  - Test empty input

- `tests/unit/markdown.test.ts`

  - Test Markdown digest generation
  - Test thread grouping
  - Test metadata formatting
  - Snapshot tests for output format

- `tests/unit/retry.test.ts`
  - Test exponential backoff calculation
  - Test jitter application
  - Test max attempts
  - Test retryable vs non-retryable errors

**Fixtures**: Mock GitLab API responses in `tests/fixtures/`

### 10.2 Integration Tests

**Approach**: Use HTTP fixtures (e.g., `nock` or MSW) to mock GitLab API

**Key test files**:

- `tests/integration/gitlab-client.test.ts`

  - Test pagination handling (2-3 pages)
  - Test auth header injection
  - Test error mapping (401, 404, 429, 5xx)
  - Test timeouts

- `tests/integration/tool-handler.test.ts`
  - End-to-end tool invocation with mocked API
  - Test all input combinations
  - Test output schema validation
  - Test error responses

### 10.3 E2E Tests (Manual)

**Setup**:

1. Create a test GitLab project with a sample MR
2. Add discussions (inline comments) and notes
3. Configure MCP server with token
4. Invoke tool from Cursor/Claude Desktop
5. Verify output correctness

**Checklist**:

- [ ] Fetch discussions + notes
- [ ] Filter system notes
- [ ] Filter unresolved only
- [ ] Markdown format
- [ ] Self-managed GitLab (if available)
- [ ] Error handling (invalid token, bad MR)

### 10.4 CI Pipeline

**GitHub Actions workflow** (`.github/workflows/ci.yml`):

```yaml
name: CI
on: [push, pull_request]
jobs:
  build-test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node-version: [18.x, 20.x, 22.x]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node-version }}
          cache: npm
      - run: npm ci
      - run: npm run build
      - run: npm run lint
      - run: npm test
      - run: npm run test:coverage
      - uses: codecov/codecov-action@v3
        with:
          files: ./coverage/lcov.info
```

**Gates**:

- Build succeeds on all Node versions
- Lint passes (eslint + prettier)
- All tests pass
- Coverage ≥ 80%

---

## 11) Implementation Roadmap

### Phase 1: Foundation (Week 1)

**Goal**: Core infrastructure and basic GitLab API integration

**Tasks**:

1. [ ] Initialize project structure (see Module Structure)
2. [ ] Set up TypeScript config (`tsconfig.json`)
3. [ ] Install dependencies: `@modelcontextprotocol/sdk`, `undici`, `zod`
4. [ ] Implement `utils/config.ts` (env loading)
5. [ ] Implement `utils/logger.ts` (structured logging)
6. [ ] Implement `services/gitlab-client.ts` (HTTP wrapper)
7. [ ] Write unit tests for config and logger

**Deliverables**:

- Working HTTP client with auth and pagination
- Structured logging with redaction
- CI pipeline (basic build + lint)

---

### Phase 2: Core Functionality (Week 2)

**Goal**: Fetch, normalize, and filter comments

**Tasks**:

1. [ ] Implement `services/discussions.ts` (fetch discussions)
2. [ ] Implement `services/notes.ts` (fetch notes)
3. [ ] Implement `processors/normalizer.ts` (Discussion/Note → Comment)
4. [ ] Implement `processors/filter.ts` (filtering + sorting)
5. [ ] Implement `utils/retry.ts` (exponential backoff)
6. [ ] Implement `utils/errors.ts` (error mapping)
7. [ ] Write unit tests for normalizer and filter
8. [ ] Write integration tests for API fetchers (mocked)

**Deliverables**:

- Complete data pipeline from GitLab API to normalized `Comment[]`
- Filtering and sorting logic
- Retry and error handling

---

### Phase 3: MCP Integration (Week 3)

**Goal**: Expose tool via MCP server

**Tasks**:

1. [ ] Implement `server.ts` (MCP server entry point)
2. [ ] Implement `tools/gitlab-mr-comments.ts` (tool handler)
3. [ ] Define Zod schemas for input/output
4. [ ] Implement tool orchestration logic
5. [ ] Test tool invocation (mocked GitLab API)
6. [ ] Write integration test for end-to-end flow

**Deliverables**:

- Working MCP server with `gitlab_get_mr_comments` tool
- Input validation and output schema enforcement
- Basic error responses

---

### Phase 4: Markdown & Polish (Week 4)

**Goal**: Markdown output and final polish

**Tasks**:

1. [ ] Implement `processors/markdown.ts` (digest generation)
2. [ ] Write unit tests for Markdown generation (snapshot tests)
3. [ ] Add examples (`examples/request.json`, `examples/response.json`, `examples/response.md`)
4. [ ] Generate JSON Schema from Zod schemas (`schemas/gitlab-mr-comments.schema.json`)
5. [ ] Write comprehensive README.md
6. [ ] Add configuration examples for Cursor and Claude Desktop
7. [ ] Add troubleshooting guide
8. [ ] Final CI pipeline polish (coverage, matrix testing)

**Deliverables**:

- Markdown output support
- Complete documentation
- Example configurations
- JSON Schema export

---

### Phase 5: Testing & Release (Week 5)

**Goal**: Comprehensive testing and v1.0 release

**Tasks**:

1. [ ] E2E testing with real GitLab API (test project)
2. [ ] Test in Cursor and Claude Desktop
3. [ ] Performance benchmarking (latency, memory)
4. [ ] Security audit (token handling, logging)
5. [ ] CHANGELOG.md (document v1.0 features)
6. [ ] GitHub release (tag v1.0.0)
7. [ ] (Optional) Publish to npm

**Deliverables**:

- Stable v1.0 release
- Documented in production
- Performance/security validated

---

## Appendix A: Key Dependencies

```json
{
  "dependencies": {
    "@modelcontextprotocol/sdk": "^0.5.0",
    "undici": "^6.0.0",
    "zod": "^3.22.0",
    "zod-to-json-schema": "^3.22.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "typescript": "^5.3.0",
    "vitest": "^1.1.0",
    "eslint": "^8.56.0",
    "prettier": "^3.1.0",
    "nock": "^13.5.0"
  }
}
```

---

## Appendix B: Sample Configurations

### Cursor (`~/.cursor/mcp.json`)

```json
{
  "mcpServers": {
    "gitlab-mr-comments": {
      "command": "node",
      "args": ["/absolute/path/to/gitlab-mcp/dist/server.js"],
      "env": {
        "GITLAB_BASE_URL": "https://gitlab.com",
        "GITLAB_TOKEN": "glpat_xxx",
        "LOG_LEVEL": "INFO"
      }
    }
  }
}
```

### Claude Desktop (`~/Library/Application Support/Claude/claude_desktop_config.json`)

```json
{
  "mcpServers": {
    "gitlab-mr-comments": {
      "command": "node",
      "args": ["/absolute/path/to/gitlab-mcp/dist/server.js"],
      "env": {
        "GITLAB_BASE_URL": "https://gitlab.com",
        "GITLAB_TOKEN": "glpat_xxx",
        "LOG_LEVEL": "INFO"
      }
    }
  }
}
```

---

## Appendix C: Decision Log

### Why TypeScript?

- Type safety reduces runtime errors
- Better IDE support and refactoring
- Standard for modern Node.js projects

### Why Zod?

- Runtime validation + type inference
- Easy JSON Schema generation
- Great DX with TypeScript

### Why undici?

- Native to Node.js ecosystem
- Modern fetch API
- Better performance than `axios` or `node-fetch`

### Why stdio transport?

- Simplest MCP transport (no HTTP server needed)
- Broadest client compatibility
- Recommended by MCP docs

### Why separate normalizer, filter, markdown?

- Single responsibility
- Easier to test in isolation
- Future extensibility (e.g., alternative output formats)

### Why exponential backoff with jitter?

- Industry standard for retries
- Avoids thundering herd
- GitLab API best practices

---

## Appendix D: Future Enhancements (v1.1+)

1. **GraphQL tool**: Single-query fetch with fewer roundtrips
2. **Draft notes**: Support fetching draft comments (if API permits)
3. **Comment permalinks**: Generate web URLs for each comment
4. **MR metadata**: Include MR title, author, state in output envelope
5. **Streaming**: Stream comments as they're fetched (MCP protocol permitting)
6. **Caching**: Optional client-side caching with `updatedSince` filter
7. **Multiple MRs**: Batch fetch for multiple MRs in one tool call
8. **Webhooks**: Subscribe to MR comment events (future MCP feature)

---

**End of System Design Document**
