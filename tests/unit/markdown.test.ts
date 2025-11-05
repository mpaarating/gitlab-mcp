import { describe, it, expect } from "vitest";
import { generateMarkdown } from "../../src/processors/markdown.js";
import type { Comment } from "../../src/types/schemas.js";

describe("markdown", () => {
  describe("generateMarkdown", () => {
    it("should generate markdown with project and MR info", () => {
      const comments: Comment[] = [
        {
          source: "discussion",
          thread_id: "disc1",
          note_id: 1,
          author: { id: 101, username: "reviewer1", name: "Alice Reviewer" },
          body: "Please add error handling here",
          created_at: "2025-01-01T10:00:00.000Z",
          updated_at: null,
          system: false,
          resolvable: true,
          resolved: false,
          resolved_by: null,
          position: null,
          file_path: "src/api/users.ts",
        },
      ];

      const markdown = generateMarkdown(comments, {
        project: "my-org/my-repo",
        mr: 123,
      });

      expect(markdown).toContain("my-org/my-repo");
      expect(markdown).toContain("!123");
      expect(markdown).toContain("src/api/users.ts");
      expect(markdown).toContain("@reviewer1");
      expect(markdown).toContain("Please add error handling here");
    });

    it("should handle empty comments array", () => {
      const markdown = generateMarkdown([], {
        project: "test/repo",
        mr: 1,
      });

      expect(markdown).toBeTruthy();
      expect(markdown).toContain("test/repo");
    });

    it("should include author information", () => {
      const comments: Comment[] = [
        {
          source: "note",
          thread_id: null,
          note_id: 2,
          author: { id: 102, username: "user2", name: "User Two" },
          body: "Overview comment",
          created_at: "2025-01-01T11:00:00.000Z",
          updated_at: null,
          system: false,
          resolvable: false,
          resolved: null,
          resolved_by: null,
          position: null,
          file_path: null,
        },
      ];

      const markdown = generateMarkdown(comments, {
        project: "test/repo",
        mr: 1,
      });

      expect(markdown).toContain("@user2");
    });

    it("should handle comments with file paths", () => {
      const comments: Comment[] = [
        {
          source: "discussion",
          thread_id: "disc1",
          note_id: 1,
          author: { id: 1, username: "user", name: "User" },
          body: "Comment in fileA",
          created_at: "2025-01-01T10:00:00.000Z",
          updated_at: null,
          system: false,
          resolvable: true,
          resolved: false,
          resolved_by: null,
          position: null,
          file_path: "src/fileA.ts",
        },
        {
          source: "discussion",
          thread_id: "disc2",
          note_id: 2,
          author: { id: 2, username: "user2", name: "User Two" },
          body: "Comment in fileB",
          created_at: "2025-01-01T11:00:00.000Z",
          updated_at: null,
          system: false,
          resolvable: true,
          resolved: false,
          resolved_by: null,
          position: null,
          file_path: "src/fileB.ts",
        },
      ];

      const markdown = generateMarkdown(comments, {
        project: "test/repo",
        mr: 1,
      });

      expect(markdown).toContain("fileA.ts");
      expect(markdown).toContain("fileB.ts");
    });

    it("should show resolution status", () => {
      const comments: Comment[] = [
        {
          source: "discussion",
          thread_id: "disc1",
          note_id: 1,
          author: { id: 1, username: "user", name: "User" },
          body: "Unresolved issue",
          created_at: "2025-01-01T10:00:00.000Z",
          updated_at: null,
          system: false,
          resolvable: true,
          resolved: false,
          resolved_by: null,
          position: null,
          file_path: "src/file.ts",
        },
        {
          source: "discussion",
          thread_id: "disc2",
          note_id: 2,
          author: { id: 1, username: "user", name: "User" },
          body: "Resolved issue",
          created_at: "2025-01-01T11:00:00.000Z",
          updated_at: null,
          system: false,
          resolvable: true,
          resolved: true,
          resolved_by: { id: 2, username: "resolver", name: "Resolver" },
          position: null,
          file_path: "src/file.ts",
        },
      ];

      const markdown = generateMarkdown(comments, {
        project: "test/repo",
        mr: 1,
      });

      // Should contain resolution indicators
      expect(markdown).toContain("Unresolved");
      expect(markdown).toContain("Resolved");
    });
  });
});
