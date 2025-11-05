/**
 * Error mapping and handling utilities
 * Transforms GitLab API errors into agent-friendly messages with remediation hints
 */

export class GitLabError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode?: number,
    public remediation?: string
  ) {
    super(message);
    this.name = "GitLabError";
  }
}

/**
 * Map various error types to MCP-compatible errors with helpful messages
 */
export function mapToMcpError(error: unknown): Error {
  // Handle our custom GitLab errors
  if (error instanceof GitLabError) {
    const message = error.remediation
      ? `${error.message}\n\nSuggestion: ${error.remediation}`
      : error.message;
    return new Error(message);
  }

  // Handle HTTP response errors
  if (error && typeof error === "object" && "status" in error) {
    const status = (error as { status: number }).status;

    if (status === 401 || status === 403) {
      return new Error(
        "Authentication failed. Ensure GITLAB_TOKEN is set with 'read_api' or 'api' scope.\n\n" +
          "To create a token:\n" +
          "1. Go to GitLab → Preferences → Access Tokens\n" +
          "2. Create a token with 'read_api' scope\n" +
          "3. Set GITLAB_TOKEN environment variable"
      );
    }

    if (status === 404) {
      return new Error(
        "Project or MR not found. Verify:\n" +
          "1. Project path is correct (e.g., 'group/project')\n" +
          "2. MR IID is correct (the !123 number, not the internal ID)\n" +
          "3. Token has access to the project"
      );
    }

    if (status === 429) {
      return new Error(
        "Rate limit exceeded. GitLab API rate limits:\n" +
          "- Free tier: 300 requests/minute\n" +
          "- Try again in a moment or use 'onlyUnresolved' filter to reduce requests"
      );
    }

    if (status >= 500) {
      return new Error(
        "GitLab API is experiencing issues. Try again later.\n\n" +
          "Check status at: https://status.gitlab.com"
      );
    }

    return new Error(`HTTP ${status} error from GitLab API`);
  }

  // Handle network/timeout errors
  if (error && typeof error === "object" && "code" in error) {
    const code = (error as { code: string }).code;
    if (code === "ETIMEDOUT" || code === "ECONNABORTED") {
      return new Error(
        "Request timed out. Check your network connection or try:\n" +
          "1. Increasing REQUEST_TIMEOUT environment variable\n" +
          "2. Using filters to reduce data volume"
      );
    }
  }

  // Default fallback
  const message = error instanceof Error ? error.message : String(error);
  return new Error(`An unexpected error occurred: ${message}`);
}
