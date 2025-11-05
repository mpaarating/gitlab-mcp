import { describe, it, expect } from "vitest";
import { applyFilters } from "../../src/processors/filter.js";
import type { Comment } from "../../src/types/schemas.js";

describe("filter", () => {
  const mockComments: Comment[] = [
    {
      source: "discussion",
      thread_id: "disc1",
      note_id: 1,
      author: { id: 1, username: "user1", name: "User One" },
      body: "Unresolved inline comment",
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
      author: { id: 2, username: "user2", name: "User Two" },
      body: "Resolved inline comment",
      created_at: "2025-01-01T11:00:00.000Z",
      updated_at: null,
      system: false,
      resolvable: true,
      resolved: true,
      resolved_by: { id: 3, username: "resolver", name: "Resolver" },
      position: null,
      file_path: "src/file.ts",
    },
    {
      source: "note",
      thread_id: null,
      note_id: 3,
      author: { id: 4, username: "user3", name: "User Three" },
      body: "Overview comment",
      created_at: "2025-01-01T12:00:00.000Z",
      updated_at: null,
      system: false,
      resolvable: false,
      resolved: null,
      resolved_by: null,
      position: null,
      file_path: null,
    },
    {
      source: "discussion",
      thread_id: "disc3",
      note_id: 4,
      author: { id: 5, username: "system", name: "GitLab" },
      body: "added 3 commits",
      created_at: "2025-01-01T09:00:00.000Z",
      updated_at: null,
      system: true,
      resolvable: false,
      resolved: null,
      resolved_by: null,
      position: null,
      file_path: null,
    },
  ];

  describe("system note filtering", () => {
    it("should filter out system notes by default", () => {
      const filtered = applyFilters(mockComments, { includeSystem: false, onlyResolved: false, onlyUnresolved: false });
      expect(filtered).toHaveLength(3);
      expect(filtered.every((c) => !c.system)).toBe(true);
    });

    it("should include system notes when includeSystem=true", () => {
      const filtered = applyFilters(mockComments, { includeSystem: true, onlyResolved: false, onlyUnresolved: false });
      expect(filtered).toHaveLength(4);
      expect(filtered.some((c) => c.system)).toBe(true);
    });
  });

  describe("resolution status filtering", () => {
    it("should filter to only unresolved comments", () => {
      const filtered = applyFilters(mockComments, { includeSystem: false, onlyUnresolved: true, onlyResolved: false });
      expect(filtered).toHaveLength(1);
      expect(filtered.every((c) => c.resolvable && c.resolved === false)).toBe(true);
    });

    it("should filter to only resolved comments", () => {
      const filtered = applyFilters(mockComments, { includeSystem: false, onlyResolved: true, onlyUnresolved: false });
      expect(filtered).toHaveLength(1);
      expect(filtered.every((c) => c.resolvable && c.resolved === true)).toBe(true);
    });

    it("should return all comments when no resolution filter", () => {
      const filtered = applyFilters(mockComments, { includeSystem: false, onlyResolved: false, onlyUnresolved: false });
      expect(filtered).toHaveLength(3); // Excludes system note
    });
  });

  describe("chronological sorting", () => {
    it("should sort comments by created_at ascending", () => {
      const unordered: Comment[] = [
        {
          ...mockComments[2],
          created_at: "2025-01-01T15:00:00.000Z",
        },
        {
          ...mockComments[0],
          created_at: "2025-01-01T10:00:00.000Z",
        },
        {
          ...mockComments[1],
          created_at: "2025-01-01T12:00:00.000Z",
        },
      ];

      const filtered = applyFilters(unordered, { includeSystem: false, onlyResolved: false, onlyUnresolved: false });

      expect(filtered[0].created_at).toBe("2025-01-01T10:00:00.000Z");
      expect(filtered[1].created_at).toBe("2025-01-01T12:00:00.000Z");
      expect(filtered[2].created_at).toBe("2025-01-01T15:00:00.000Z");
    });
  });

  describe("edge cases", () => {
    it("should handle empty input", () => {
      const filtered = applyFilters([], { includeSystem: false, onlyResolved: false, onlyUnresolved: false });
      expect(filtered).toHaveLength(0);
    });

    it("should handle all comments being filtered out", () => {
      const systemOnly: Comment[] = [
        {
          ...mockComments[3],
        },
      ];

      const filtered = applyFilters(systemOnly, { includeSystem: false, onlyResolved: true, onlyUnresolved: false });
      expect(filtered).toHaveLength(0);
    });
  });

  describe("combined filters", () => {
    it("should apply multiple filters together", () => {
      const filtered = applyFilters(mockComments, {
        includeSystem: false,
        onlyUnresolved: true,
        onlyResolved: false,
      });

      expect(filtered).toHaveLength(1);
      expect(filtered.every((c) => !c.system && c.resolvable && c.resolved === false)).toBe(true);
    });
  });
});

