import { describe, it, expect } from "vitest";
import { GitLabError, mapToMcpError } from "../../src/utils/errors.js";

describe("errors", () => {
  describe("GitLabError", () => {
    it("should create error with all properties", () => {
      const error = new GitLabError(
        "Test error",
        "TEST_CODE",
        404,
        "Try checking the path"
      );

      expect(error.message).toBe("Test error");
      expect(error.code).toBe("TEST_CODE");
      expect(error.statusCode).toBe(404);
      expect(error.remediation).toBe("Try checking the path");
      expect(error.name).toBe("GitLabError");
    });
  });

  describe("mapToMcpError", () => {
    it("should handle GitLabError with remediation", () => {
      const gitlabError = new GitLabError(
        "Not found",
        "NOT_FOUND",
        404,
        "Check the project path"
      );

      const mcpError = mapToMcpError(gitlabError);

      expect(mcpError.message).toContain("Not found");
      expect(mcpError.message).toContain("Suggestion: Check the project path");
    });

    it("should handle GitLabError without remediation", () => {
      const gitlabError = new GitLabError("Generic error", "GENERIC", 500);

      const mcpError = mapToMcpError(gitlabError);

      expect(mcpError.message).toBe("Generic error");
    });

    it("should handle 401 authentication errors", () => {
      const error = { status: 401 };
      const mcpError = mapToMcpError(error);

      expect(mcpError.message).toContain("Authentication failed");
      expect(mcpError.message).toContain("GITLAB_TOKEN");
      expect(mcpError.message).toContain("read_api");
    });

    it("should handle 403 forbidden errors", () => {
      const error = { status: 403 };
      const mcpError = mapToMcpError(error);

      expect(mcpError.message).toContain("Authentication failed");
    });

    it("should handle 404 not found errors", () => {
      const error = { status: 404 };
      const mcpError = mapToMcpError(error);

      expect(mcpError.message).toContain("Project or MR not found");
      expect(mcpError.message).toContain("Project path is correct");
      expect(mcpError.message).toContain("MR IID is correct");
    });

    it("should handle 429 rate limit errors", () => {
      const error = { status: 429 };
      const mcpError = mapToMcpError(error);

      expect(mcpError.message).toContain("Rate limit exceeded");
      expect(mcpError.message).toContain("300 requests/minute");
    });

    it("should handle 5xx server errors", () => {
      const error = { status: 500 };
      const mcpError = mapToMcpError(error);

      expect(mcpError.message).toContain("GitLab API is experiencing issues");
      expect(mcpError.message).toContain("status.gitlab.com");
    });

    it("should handle timeout errors", () => {
      const error = { code: "ETIMEDOUT" };
      const mcpError = mapToMcpError(error);

      expect(mcpError.message).toContain("Request timed out");
      expect(mcpError.message).toContain("REQUEST_TIMEOUT");
    });

    it("should handle connection aborted errors", () => {
      const error = { code: "ECONNABORTED" };
      const mcpError = mapToMcpError(error);

      expect(mcpError.message).toContain("Request timed out");
    });

    it("should handle generic Error objects", () => {
      const error = new Error("Something went wrong");
      const mcpError = mapToMcpError(error);

      expect(mcpError.message).toContain("An unexpected error occurred");
      expect(mcpError.message).toContain("Something went wrong");
    });

    it("should handle string errors", () => {
      const error = "String error message";
      const mcpError = mapToMcpError(error);

      expect(mcpError.message).toContain("An unexpected error occurred");
      expect(mcpError.message).toContain("String error message");
    });

    it("should handle unknown error types", () => {
      const error = { unknown: "property" };
      const mcpError = mapToMcpError(error);

      expect(mcpError.message).toContain("An unexpected error occurred");
    });
  });
});

