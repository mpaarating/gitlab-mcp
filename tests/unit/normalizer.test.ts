import { describe, it, expect } from "vitest";
import { normalizeComments } from "../../src/processors/normalizer.js";
import type { GitLabDiscussion, GitLabNote } from "../../src/types/gitlab.js";

describe("normalizer", () => {
  describe("normalizeComments", () => {
    it("should normalize discussions and notes together", () => {
      const discussions: GitLabDiscussion[] = [
        {
          id: "disc1",
          notes: [
            {
              id: 1,
              type: null,
              body: "Discussion comment",
              author: {
                id: 101,
                username: "user1",
                name: "User One",
              },
              created_at: "2025-01-01T10:00:00.000Z",
              updated_at: "2025-01-01T10:00:00.000Z",
              system: false,
              noteable_id: 500,
              noteable_type: "MergeRequest",
              resolvable: true,
              resolved: false,
              resolved_by: null,
              position: {
                base_sha: "abc",
                start_sha: "def",
                head_sha: "ghi",
                old_path: "src/file.ts",
                new_path: "src/file.ts",
                position_type: "text",
                old_line: null,
                new_line: 45,
              },
            },
          ],
        },
      ];

      const notes: GitLabNote[] = [
        {
          id: 2,
          type: null,
          body: "Overview note",
          author: {
            id: 102,
            username: "user2",
            name: "User Two",
          },
          created_at: "2025-01-01T11:00:00.000Z",
          updated_at: "2025-01-01T11:00:00.000Z",
          system: false,
          noteable_id: 500,
          noteable_type: "MergeRequest",
          resolvable: false,
          resolved: false,
          resolved_by: null,
        },
      ];

      const comments = normalizeComments(discussions, notes);

      expect(comments).toHaveLength(2);
      
      // Check discussion comment
      expect(comments[0]).toMatchObject({
        source: "discussion",
        thread_id: "disc1",
        note_id: 1,
        body: "Discussion comment",
        system: false,
        file_path: "src/file.ts",
      });
      expect(comments[0].author).toMatchObject({
        username: "user1",
        name: "User One",
      });

      // Check overview note
      expect(comments[1]).toMatchObject({
        source: "note",
        thread_id: null,
        note_id: 2,
        body: "Overview note",
        system: false,
        file_path: null,
      });
    });

    it("should handle system notes", () => {
      const discussions: GitLabDiscussion[] = [
        {
          id: "sys1",
          notes: [
            {
              id: 10,
              type: "DiffNote",
              body: "added 3 commits",
              author: {
                id: 1,
                username: "developer",
                name: "Developer",
              },
              created_at: "2025-01-01T09:00:00.000Z",
              updated_at: "2025-01-01T09:00:00.000Z",
              system: true,
              noteable_id: 500,
              noteable_type: "MergeRequest",
              resolvable: false,
              resolved: false,
              resolved_by: null,
            },
          ],
        },
      ];

      const comments = normalizeComments(discussions, []);

      expect(comments).toHaveLength(1);
      expect(comments[0].system).toBe(true);
    });

    it("should extract file paths from positions", () => {
      const discussions: GitLabDiscussion[] = [
        {
          id: "pos1",
          notes: [
            {
              id: 20,
              type: null,
              body: "Comment",
              author: {
                id: 1,
                username: "user",
                name: "User",
              },
              created_at: "2025-01-01T10:00:00.000Z",
              updated_at: "2025-01-01T10:00:00.000Z",
              system: false,
              noteable_id: 1,
              noteable_type: "MergeRequest",
              resolvable: true,
              resolved: false,
              resolved_by: null,
              position: {
                base_sha: "a",
                start_sha: "b",
                head_sha: "c",
                old_path: "old/path.ts",
                new_path: "new/path.ts",
                position_type: "text",
                old_line: 10,
                new_line: 20,
              },
            },
          ],
        },
      ];

      const comments = normalizeComments(discussions, []);

      expect(comments[0].file_path).toBe("new/path.ts");
    });

    it("should handle missing positions", () => {
      const discussions: GitLabDiscussion[] = [
        {
          id: "no_pos",
          notes: [
            {
              id: 30,
              type: null,
              body: "Comment without position",
              author: {
                id: 1,
                username: "user",
                name: "User",
              },
              created_at: "2025-01-01T10:00:00.000Z",
              updated_at: "2025-01-01T10:00:00.000Z",
              system: false,
              noteable_id: 1,
              noteable_type: "MergeRequest",
              resolvable: false,
              resolved: false,
              resolved_by: null,
            },
          ],
        },
      ];

      const comments = normalizeComments(discussions, []);

      expect(comments[0].file_path).toBeNull();
    });

    it("should handle resolved comments", () => {
      const discussions: GitLabDiscussion[] = [
        {
          id: "resolved1",
          notes: [
            {
              id: 40,
              type: null,
              body: "Resolved comment",
              author: {
                id: 1,
                username: "user",
                name: "User",
              },
              created_at: "2025-01-01T10:00:00.000Z",
              updated_at: "2025-01-01T11:00:00.000Z",
              system: false,
              noteable_id: 1,
              noteable_type: "MergeRequest",
              resolvable: true,
              resolved: true,
              resolved_by: {
                id: 2,
                username: "resolver",
                name: "Resolver",
              },
            },
          ],
        },
      ];

      const comments = normalizeComments(discussions, []);

      expect(comments[0].resolved).toBe(true);
      expect(comments[0].resolved_by).toMatchObject({
        username: "resolver",
      });
    });
  });
});
