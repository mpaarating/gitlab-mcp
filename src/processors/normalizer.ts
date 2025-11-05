/**
 * Comment normalizer
 * Transforms GitLab Discussion and Note objects into unified Comment structure
 */

import type { GitLabDiscussion, GitLabNote, GitLabPosition } from "../types/gitlab.js";
import type { Comment } from "../types/schemas.js";

/**
 * Extract file path from GitLab position object
 */
function extractFilePath(position: GitLabPosition | undefined | null): string | null {
  if (!position) return null;
  return position.new_path || position.old_path || null;
}

/**
 * Normalize a single note from a discussion thread
 */
function normalizeDiscussionNote(note: GitLabNote, threadId: string): Comment {
  return {
    source: "discussion",
    thread_id: threadId,
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
    updated_at: note.updated_at || null,
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
    position: note.position ? (note.position as Record<string, unknown>) : null,
    file_path: extractFilePath(note.position),
  };
}

/**
 * Normalize a GitLab discussion into Comment array
 * Preserves chronological order within the thread
 */
function normalizeDiscussion(discussion: GitLabDiscussion): Comment[] {
  return discussion.notes.map((note) => normalizeDiscussionNote(note, discussion.id));
}

/**
 * Normalize a standalone note into a Comment
 */
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
    updated_at: note.updated_at || null,
    system: note.system ?? false,
    resolvable: false, // Standalone notes are not resolvable
    resolved: null,
    resolved_by: null,
    position: null,
    file_path: null,
  };
}

/**
 * Normalize all discussions and notes into a unified Comment array
 */
export function normalizeComments(discussions: GitLabDiscussion[], notes: GitLabNote[]): Comment[] {
  const comments: Comment[] = [];

  // Add all discussion comments
  for (const discussion of discussions) {
    comments.push(...normalizeDiscussion(discussion));
  }

  // Add all standalone notes
  for (const note of notes) {
    comments.push(normalizeNote(note));
  }

  return comments;
}
