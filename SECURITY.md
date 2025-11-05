# Security Policy

## Read-Only Guarantee

The GitLab MCP Server is designed to be **strictly read-only**. This is enforced at multiple levels:

### 1. Code-Level Enforcement
- The GitLab client (`src/services/gitlab-client.ts`) only implements `GET` method
- No write methods (POST, PUT, PATCH, DELETE) are implemented
- Type signatures explicitly exclude write operations

### 2. Token Scope Recommendations  
- **Recommended**: Use `read_api` scope for Personal Access Tokens
- **Alternative**: `api` scope (if `read_api` is unavailable, but grants broader access)
- **Never use**: Tokens with write permissions (`write_repository`, etc.)

### 3. API Surface
- Single tool: `gitlab_get_mr_comments` (read-only operation)
- No tools for creating, updating, or deleting resources
- All operations are idempotent

## Security Best Practices

### Token Management

**DO:**
- ✅ Store tokens in environment variables (`GITLAB_TOKEN`)
- ✅ Use minimal scope tokens (`read_api`)
- ✅ Rotate tokens regularly
- ✅ Use project-specific tokens when possible
- ✅ Revoke tokens when no longer needed

**DON'T:**
- ❌ Hardcode tokens in configuration files
- ❌ Commit tokens to version control
- ❌ Share tokens between projects
- ❌ Use admin-level tokens
- ❌ Log tokens or include them in error messages

### Configuration Security

**Environment Variables:**
```bash
# Good: Set in shell/CI environment
export GITLAB_TOKEN="glpat-xxx"

# Bad: Hardcoded in MCP config
{
  "env": {
    "GITLAB_TOKEN": "glpat-12345..."  # Don't do this if config is committed
  }
}
```

**MCP Configuration:**
- Store MCP configs (`mcp.json`, `claude_desktop_config.json`) outside of versioned directories
- Use absolute paths to prevent directory traversal
- Ensure config files have appropriate permissions (chmod 600)

### Logging and Privacy

The server implements secure logging:

- **Token Redaction**: Tokens are automatically redacted from all logs
- **No Request Bodies**: Request/response bodies only logged in DEBUG mode with `LOG_PAYLOADS=true`
- **Correlation IDs**: Use correlation IDs for request tracking without exposing sensitive data
- **Structured Logs**: JSON format for secure parsing and filtering

### Network Security

**Self-Managed GitLab:**
- Use HTTPS URLs for `GITLAB_BASE_URL`
- Verify TLS certificates (default behavior with `undici`)
- Consider using certificate pinning for high-security environments

**Rate Limiting:**
- Built-in retry logic with exponential backoff
- Respects GitLab rate limits (300 requests/minute for free tier)
- Automatic throttling on 429 responses

### Input Validation

All inputs are validated using Zod schemas:

- Project names are required strings
- MR numbers are positive integers
- Boolean flags are strictly typed
- Enum values (format) are validated

Invalid inputs are rejected before any API calls.

## Vulnerability Reporting

If you discover a security vulnerability, please report it responsibly:

### Do NOT:
- ❌ Open a public GitHub issue
- ❌ Disclose the vulnerability publicly

### Instead:
1. Email the maintainer (see `package.json` author field)
2. Include:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if you have one)

### Response Timeline:
- **24 hours**: Initial acknowledgment
- **7 days**: Assessment and triage
- **30 days**: Fix released (target)

## Security Updates

Security updates are released as soon as possible and announced in:

- `CHANGELOG.md` with `[SECURITY]` tag
- GitHub Security Advisories
- Release notes

## Audit Log

No changes to GitLab resources are made, so no audit logs are generated. However, you can monitor:

- MCP server logs (structured JSON with correlation IDs)
- GitLab API access logs (if you have admin access)
- Token usage in GitLab Settings → Access Tokens

## Compliance

### Data Handling
- **No Persistence**: Comments are fetched on-demand and not stored
- **In-Memory Only**: All processing happens in memory
- **No External Calls**: Only contacts specified GitLab instance

### GDPR Considerations
- Comments may contain personal data (author names, usernames)
- Data is processed only as requested by the user
- No data is retained after request completion
- Users control what data is accessed via filters

## Secure Deployment Checklist

When deploying the GitLab MCP Server:

- [ ] Use `read_api` scope tokens
- [ ] Store tokens in environment variables
- [ ] Use HTTPS for GitLab URLs
- [ ] Set appropriate log levels (INFO for production)
- [ ] Disable payload logging (`LOG_PAYLOADS=false`)
- [ ] Regularly update dependencies (`npm audit`)
- [ ] Review and rotate tokens quarterly
- [ ] Monitor access logs
- [ ] Use project-specific tokens when possible
- [ ] Set minimal token expiration periods

## Dependencies

We minimize dependencies and regularly audit them:

```bash
npm audit
```

Core dependencies:
- `@modelcontextprotocol/sdk` - MCP protocol implementation
- `undici` - Fast, secure HTTP client
- `zod` - Runtime validation
- `zod-to-json-schema` - Schema generation

All dependencies are pinned to specific versions and reviewed before updates.

## Security Features Summary

| Feature | Implementation |
|---------|----------------|
| Read-Only | ✅ Enforced at code, type, and API level |
| Token Redaction | ✅ Automatic in all logs |
| Input Validation | ✅ Zod schemas with strict checking |
| Rate Limiting | ✅ Built-in retry with backoff |
| TLS/HTTPS | ✅ Required and verified |
| Minimal Permissions | ✅ `read_api` scope recommended |
| No Data Persistence | ✅ In-memory only |
| Dependency Auditing | ✅ Regular automated checks |

## Questions?

For security-related questions (non-vulnerabilities):
- Open a [GitHub Discussion](https://github.com/mpaarating/gitlab-mcp/discussions)
- Tag with `security` label

Thank you for helping keep GitLab MCP Server secure! 🔒

