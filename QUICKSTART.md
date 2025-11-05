# Quick Start Guide

Get the GitLab MCP Server running in 5 minutes!

## Prerequisites

- Node.js 18 or higher
- A GitLab account with access to merge requests
- A Personal Access Token from GitLab

## Step 1: Install Dependencies

```bash
npm install
```

## Step 2: Build the Server

```bash
npm run build
```

This compiles TypeScript to JavaScript in the `dist/` directory.

## Step 3: Configure Environment Variables

1. **Copy the example environment file:**

   ```bash
   cp .env.example .env
   ```

2. **Get Your GitLab Token:**
   - Go to **GitLab** → **Preferences** → **Access Tokens**
   - Click **Add new token**
   - Name: `MCP Server - Read Only`
   - Scopes: Select **`read_api`** only (recommended for security)
   - Click **Create personal access token**
   - **Copy the token** (you won't see it again!)

3. **Edit `.env` file:**
   ```bash
   GITLAB_TOKEN=glpat-your-token-here
   # GITLAB_BASE_URL=https://gitlab.com  # Uncomment for self-managed
   ```

## Step 4: Test Your Configuration (Optional but Recommended)

Before configuring your MCP client, verify your setup:

```bash
npx tsx scripts/test-connection.ts
```

**Expected output:**

```
🔍 Testing GitLab MCP Server Configuration

1️⃣ Loading configuration...
   ✅ GitLab URL: https://gitlab.com
   ✅ Token: glpat-xxxx...
   ✅ Log Level: INFO

2️⃣ Testing GitLab API connection...
   ✅ Connected as: Your Name (@youruser)

3️⃣ Verifying token permissions...
   ✅ Token has API access

✨ Configuration test successful!
```

If you see errors, the script will provide helpful troubleshooting tips!

---

## Step 5: Configure Your MCP Client

### Option A: Cursor

Create or edit `~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "gitlab-mr-comments": {
      "command": "node",
      "args": ["/absolute/path/to/gitlab-mcp/dist/server.js"],
      "env": {
        "GITLAB_TOKEN": "glpat_YOUR_TOKEN_HERE"
      }
    }
  }
}
```

**Replace** `/absolute/path/to/gitlab-mcp` with your actual installation path!

### Option B: Claude Desktop

**macOS**: Edit `~/Library/Application Support/Claude/claude_desktop_config.json`

**Windows**: Edit `%APPDATA%/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "gitlab-mr-comments": {
      "command": "node",
      "args": ["/absolute/path/to/gitlab-mcp/dist/server.js"],
      "env": {
        "GITLAB_TOKEN": "glpat_YOUR_TOKEN_HERE"
      }
    }
  }
}
```

## Step 5: Restart Your Client

- **Cursor**: Restart Cursor completely
- **Claude Desktop**: Restart Claude Desktop

## Step 6: Available Tools

After setup, your AI agent will have access to:

### `gitlab_get_mr_comments`

**Tool Name**: `gitlab_get_mr_comments`

**What it does**: Fetches all comments (inline discussions and overview notes) from a GitLab merge request

**Required Parameters**:

- `project`: The GitLab project path (e.g., `zapier/team-sprout/templates`)
- `mr`: The merge request IID number (e.g., `530` for MR !530)

**Optional Parameters**:

- `onlyUnresolved`: Only return unresolved comments (default: false)
- `includeSystem`: Include system-generated notes (default: false)
- `format`: Return format - `json` or `markdown` (default: json)

Your AI agent should automatically discover this tool - you don't need to tell it the tool name, just describe what you want!

## Step 7: Test It!

### In Cursor or Claude, try:

```
"Fetch all unresolved comments from MR !123 in project my-org/my-repo"
```

Replace `my-org/my-repo` with your actual GitLab project path and `123` with your MR number.

## Example Prompts to Try

### Get Fix Plan

```
"Get all unresolved comments from MR !456 and create a fix plan grouped by file"
```

### File-Specific Review

```
"What feedback did reviewers leave on src/api/users.ts in MR !789?"
```

### Summary

```
"Summarize all discussions in MR !123"
```

### Markdown Output

```
"Get MR !456 comments in markdown format"
```

## Troubleshooting

### "GITLAB_TOKEN environment variable is required"

This is the most common issue when setting up the MCP server!

**Cause**: The token is not configured in your MCP client's config file, or you haven't restarted the client.

**Solution**:

1. **Check your MCP config file has the token**:

   ```json
   {
     "mcpServers": {
       "gitlab-mr-comments": {
         "command": "node",
         "args": ["/absolute/path/to/gitlab-mcp/dist/server.js"],
         "env": {
           "GITLAB_TOKEN": "glpat_your_actual_token_here"
         }
       }
     }
   }
   ```

2. **IMPORTANT**: After adding or changing the `GITLAB_TOKEN`, you MUST:
   - Completely quit Cursor/Claude Desktop (not just reload)
   - Restart the application
   - The server won't pick up changes until you restart

3. **Common mistakes**:
   - ❌ Only creating a `.env` file (not used by MCP servers)
   - ❌ Forgetting to restart after config changes
   - ❌ Using a relative path instead of absolute path to `dist/server.js`
   - ❌ Token has extra spaces or incorrect format

4. **Verify your config location**:
   - Cursor: `~/.cursor/mcp.json`
   - Claude Desktop (macOS): `~/Library/Application Support/Claude/claude_desktop_config.json`
   - Claude Desktop (Windows): `%APPDATA%/Claude/claude_desktop_config.json`

### "Authentication failed"

**Check**:

- Is your token correct?
- Does the token have `read_api` scope?
- Has the token expired?

### "Project or MR not found"

**Check**:

- Use the project **path** like `group/project`, not the numeric ID
- Use the MR **IID** (the !123 number), not the internal ID
- Does your token have access to that project?

### Server not appearing

**Check**:

- Is the path to `dist/server.js` absolute and correct?
- Did you run `npm run build`?
- Did you restart your MCP client after config changes?
- Check logs:
  - Cursor: `~/.cursor/logs`
  - Claude: `~/Library/Logs/Claude`

### Tools not discovered / "What tools are available?"

If your AI agent says it can't find tools from the gitlab-mr-comments server:

**Quick fix**: Tell the agent explicitly:

> "Use the `gitlab_get_mr_comments` tool from the gitlab-mr-comments MCP server to fetch comments from MR !530 in project zapier/team-sprout/templates"

**Root cause checks**:

1. **Is the server connected?**
   - Check your IDE's MCP server status (usually in settings)
   - Look for "gitlab-mr-comments" in connected servers
   - Should show as "Connected" or "Running"

2. **Did the server start successfully?**
   - Check logs for "GitLab MR Comments tool registered successfully"
   - If you see the GITLAB_TOKEN error instead, see troubleshooting above

3. **Try a full restart**:
   - Quit your IDE completely (not just reload)
   - Start it again
   - Wait 10-15 seconds for all MCP servers to connect

## Development Mode

For development, you can run without building:

```bash
npm run dev
```

This uses `tsx` to run TypeScript directly.

## Next Steps

- Read [README.md](./README.md) for full documentation
- Check [docs/SYSTEM_DESIGN.md](./docs/SYSTEM_DESIGN.md) for architecture details
- See [examples/](./examples/) for request/response examples
- Review [docs/GITLAB_MCP_PRD.md](./docs/GITLAB_MCP_PRD.md) for requirements

## Self-Managed GitLab

Using GitLab on your own server? Add this to your config:

```json
{
  "env": {
    "GITLAB_BASE_URL": "https://gitlab.your-company.com",
    "GITLAB_TOKEN": "glpat_YOUR_TOKEN_HERE"
  }
}
```

---

**Need help?** Open an issue on GitHub or check the full documentation.
