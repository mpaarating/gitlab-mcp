# GitLab MCP Server

[![CI](https://github.com/mpaarating/gitlab-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/mpaarating/gitlab-mcp/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-18%2B-green.svg)](https://nodejs.org/)

**A Model Context Protocol (MCP) server for retrieving GitLab merge request comments.**

🔒 **READ-ONLY**: This server only fetches data from GitLab. It never modifies MR state, comments, or any other GitLab data.

## What is this?

This MCP server enables AI coding agents (like Cursor, Claude Desktop, or any MCP-compatible client) to fetch comments from GitLab merge requests in a structured, agent-friendly format. It's designed to help agents:

- 📋 Compile unresolved comments into fix plans
- 🎯 Extract inline discussions with file paths and line numbers
- 🔍 Filter feedback by resolution status
- 📝 Generate human-readable summaries

## Features

- **Unified Comment Structure**: Combines inline discussions and overview notes into a single normalized format
- **Smart Filtering**: Include/exclude system notes, filter by resolution status
- **File Path Extraction**: Automatically extracts file paths from inline comments
- **Thread Context**: Groups related comments by discussion thread
- **Dual Output Formats**: JSON for programmatic use, Markdown for human reading
- **Retry Logic**: Handles transient errors with exponential backoff
- **Pagination Support**: Automatically fetches all pages
- **Security First**: Token-based auth, secret redaction in logs

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Build the Server

```bash
npm run build
```

### 3. Set Up GitLab Token

Create a Personal Access Token in GitLab:

1. Go to **GitLab** → **Preferences** → **Access Tokens**
2. Create a token with **`read_api`** scope (recommended for read-only access)
3. Copy the token

### 4. Configure MCP Client

#### For Cursor

Add to `~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "gitlab-mr-comments": {
      "command": "node",
      "args": ["/absolute/path/to/gitlab-mcp/dist/server.js"],
      "env": {
        "GITLAB_BASE_URL": "https://gitlab.com",
        "GITLAB_TOKEN": "glpat_your_token_here"
      }
    }
  }
}
```

#### For Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%/Claude/claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "gitlab-mr-comments": {
      "command": "node",
      "args": ["/absolute/path/to/gitlab-mcp/dist/server.js"],
      "env": {
        "GITLAB_BASE_URL": "https://gitlab.com",
        "GITLAB_TOKEN": "glpat_your_token_here"
      }
    }
  }
}
```

### 5. Restart Your MCP Client

Restart Cursor or Claude Desktop for the configuration to take effect.

## Usage

### Basic Usage

Ask your AI agent:

> "Fetch all unresolved comments from MR !123 in project my-org/my-repo"

The agent will use the `gitlab_get_mr_comments` tool with appropriate parameters.

### Example Tool Call

```json
{
  "tool": "gitlab_get_mr_comments",
  "arguments": {
    "project": "my-org/my-repo",
    "mr": 123,
    "onlyUnresolved": true,
    "includeSystem": false
  }
}
```

### Tool Parameters

| Parameter              | Type    | Default | Description                                        |
| ---------------------- | ------- | ------- | -------------------------------------------------- |
| `project`              | string  | -       | **Required.** Project path (e.g., `group/project`) |
| `mr`                   | number  | -       | **Required.** MR IID (the `!123` number)           |
| `includeSystem`        | boolean | `false` | Include system-generated notes                     |
| `includeOverviewNotes` | boolean | `true`  | Include overview (non-inline) notes                |
| `onlyResolved`         | boolean | `false` | Only show resolved comments                        |
| `onlyUnresolved`       | boolean | `false` | Only show unresolved comments                      |
| `perPage`              | number  | `100`   | Pagination size (1-100)                            |
| `format`               | string  | `json`  | Output format: `json` or `markdown`                |

**Note**: `onlyResolved` and `onlyUnresolved` are mutually exclusive.

## Agent Workflow Examples

### Fix Plan Generation

```
User: "Review all unresolved comments on MR !456 and create a fix plan"

Agent:
1. Calls gitlab_get_mr_comments with onlyUnresolved=true
2. Groups comments by file_path
3. Generates prioritized fix plan:
   - src/api/users.ts (3 comments)
     • Line 45: Add error handling
     • Line 78: Extract to helper
     • Line 92: Add validation
```

### File-Specific Review

```
User: "What feedback did reviewers leave on src/api/users.ts?"

Agent:
1. Fetches all comments from MR
2. Filters client-side for file_path = "src/api/users.ts"
3. Summarizes feedback for that specific file
```

### Release Readiness

```
User: "Summarize blocking issues on MR !789"

Agent:
1. Fetches all unresolved comments
2. Searches for keywords: "blocker", "must fix", "breaking"
3. Presents summary of blocking issues
```

## Environment Variables

| Variable          | Default              | Description                                     |
| ----------------- | -------------------- | ----------------------------------------------- |
| `GITLAB_BASE_URL` | `https://gitlab.com` | GitLab instance URL (for self-managed)          |
| `GITLAB_TOKEN`    | -                    | **Required.** Personal or Project Access Token  |
| `LOG_LEVEL`       | `INFO`               | Logging level: `DEBUG`, `INFO`, `WARN`, `ERROR` |
| `REQUEST_TIMEOUT` | `20000`              | HTTP request timeout in milliseconds            |
| `MAX_RETRIES`     | `3`                  | Max retry attempts for transient errors         |
| `LOG_PAYLOADS`    | `false`              | Log request/response payloads (dev only)        |

**Quick Setup:**

```bash
cp .env.example .env
# Edit .env with your GITLAB_TOKEN
```

See `.env.example` for detailed configuration options.

## Self-Managed GitLab

To use with a self-managed GitLab instance:

```json
{
  "env": {
    "GITLAB_BASE_URL": "https://gitlab.your-company.com",
    "GITLAB_TOKEN": "glpat_your_token_here"
  }
}
```

## Troubleshooting

### "Authentication failed"

**Cause**: Invalid or missing token, insufficient permissions

**Solution**:

- Verify `GITLAB_TOKEN` is set correctly
- Ensure token has `read_api` scope
- Check token hasn't expired
- Verify token has access to the project

### "Project or MR not found"

**Cause**: Incorrect project path or MR number

**Solution**:

- Use the project **path** (e.g., `my-org/my-project`), not the numeric ID
- Use the MR **IID** (the `!123` number visible in the URL), not the internal ID
- Ensure your token has access to the project

### "Rate limit exceeded"

**Cause**: Too many requests to GitLab API

**Solution**:

- Wait a moment before retrying
- Use `onlyUnresolved` filter to reduce requests
- Set `includeOverviewNotes: false` if not needed
- For GitLab.com: free tier = 300 requests/minute

### "Request timed out"

**Cause**: Large MR or slow network

**Solution**:

- Increase `REQUEST_TIMEOUT` environment variable
- Use filters to reduce data volume
- Check network connectivity to GitLab instance

### Server not showing up in Cursor/Claude

**Cause**: Configuration or path issues

**Solution**:

- Verify absolute path to `dist/server.js` is correct
- Check JSON syntax in config file
- Restart Cursor/Claude Desktop after config changes
- Check logs: Cursor logs in `~/.cursor/logs`, Claude logs in `~/Library/Logs/Claude`

## Development

### Run in Development Mode

```bash
npm run dev
```

### Run Tests

```bash
npm test
```

### Generate JSON Schema

```bash
npm run build
node scripts/generate-schema.ts
```

### Linting

```bash
npm run lint
npm run format
```

## Security

### Token Management

- ✅ **DO**: Use tokens with `read_api` scope (least privilege)
- ✅ **DO**: Store tokens in environment variables or secure config files
- ❌ **DON'T**: Commit tokens to version control
- ❌ **DON'T**: Share tokens publicly

### Read-Only Guarantee

This server is **explicitly designed to be read-only**:

- ✅ GitLab client only implements `GET` requests
- ✅ No `POST`, `PUT`, `PATCH`, or `DELETE` methods exist
- ✅ Recommended token scope is `read_api` (read-only)
- ✅ Integration tests verify no mutation endpoints are called

### Data Privacy

- All data is processed in-memory (no disk writes)
- No caching or persistent storage
- Secrets are automatically redacted from logs
- No external services contacted (direct GitLab API only)

## Architecture

```
AI Agent (Cursor/Claude)
        ↓ stdio (MCP Protocol)
MCP Server
        ↓ HTTPS (GET only)
GitLab REST API
```

See [`SYSTEM_DESIGN.md`](./SYSTEM_DESIGN.md) for detailed architecture documentation.

## Performance

**Typical Performance** (GitLab.com, US region):

- ≤ 2s p50 latency for MRs with ≤ 500 comments
- ≤ 5s p95 latency

**Optimization Tips**:

- Use `onlyUnresolved` to reduce data volume
- Set `includeOverviewNotes: false` if not needed
- Use `perPage: 100` (maximum) to minimize roundtrips

## Contributing

Contributions are welcome! Please read the system design document and follow the existing code patterns.

### Key Principles

1. **Read-Only**: Never add write operations
2. **Type Safety**: Use TypeScript and Zod for validation
3. **Error Handling**: Provide actionable error messages
4. **Testing**: Add tests for new functionality
5. **Documentation**: Update README and examples

## License

MIT License - see [LICENSE](./LICENSE) file for details.

## Support

- **Issues**: https://github.com/mpaarating/gitlab-mcp/issues
- **Documentation**: See [`docs/`](./docs/) directory
- **PRD**: See [`docs/GITLAB_MCP_PRD.md`](./docs/GITLAB_MCP_PRD.md)
- **System Design**: See [`docs/SYSTEM_DESIGN.md`](./docs/SYSTEM_DESIGN.md)

## Acknowledgments

Built with:

- [Model Context Protocol SDK](https://github.com/modelcontextprotocol/sdk)
- [GitLab REST API](https://docs.gitlab.com/ee/api/)
- TypeScript, Zod, undici

---

**Made with ❤️ for AI-powered code review workflows**
