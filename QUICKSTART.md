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
