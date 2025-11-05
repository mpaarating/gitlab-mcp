/**
 * Markdown digest generator
 * Creates human-readable summary of MR comments
 */

import type { Comment } from "../types/schemas.js";

export interface MarkdownOptions {
  project: string;
  mr: number;
}

/**
 * Format a timestamp for display
 */
function formatTimestamp(isoString: string): string {
  const date = new Date(isoString);
  return date
    .toISOString()
    .replace("T", " ")
    .replace(/\.\d+Z$/, " UTC");
}

/**
 * Format resolution status
 */
function formatResolutionStatus(comment: Comment): string {
  if (!comment.resolvable) return "";
  if (comment.resolved) {
    const resolver = comment.resolved_by?.username || "someone";
    return `✅ Resolved by @${resolver}`;
  }
  return "⚠️  Unresolved";
}

/**
 * Group comments by thread for better organization
 */
function groupByThread(comments: Comment[]): Map<string | null, Comment[]> {
  const groups = new Map<string | null, Comment[]>();

  for (const comment of comments) {
    const key = comment.thread_id;
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(comment);
  }

  return groups;
}

/**
 * Generate Markdown digest of comments
 */
export function generateMarkdown(comments: Comment[], options: MarkdownOptions): string {
  const lines: string[] = [];

  // Header
  lines.push(`# GitLab MR !${options.mr} Comments`);
  lines.push(`**Project**: ${options.project}`);
  lines.push(`**Fetched**: ${formatTimestamp(new Date().toISOString())}`);
  lines.push(`**Total Comments**: ${comments.length}`);
  lines.push("");
  lines.push("---");
  lines.push("");

  if (comments.length === 0) {
    lines.push("*No comments found matching the specified filters.*");
    return lines.join("\n");
  }

  // Group by thread
  const threadGroups = groupByThread(comments);

  // Separate discussions from standalone notes
  const discussions: [string, Comment[]][] = [];
  const standaloneNotes: Comment[] = [];

  for (const [threadId, comments] of threadGroups.entries()) {
    if (threadId === null) {
      standaloneNotes.push(...comments);
    } else {
      discussions.push([threadId, comments]);
    }
  }

  // Render discussions
  if (discussions.length > 0) {
    lines.push("## 💬 Discussion Threads");
    lines.push("");

    for (const [threadId, threadComments] of discussions) {
      const firstComment = threadComments[0];
      const filePath = firstComment.file_path || "General";

      lines.push(`### Thread: ${threadId.substring(0, 8)}...`);
      lines.push(`**File**: \`${filePath}\``);
      if (firstComment.resolvable) {
        lines.push(`**Status**: ${formatResolutionStatus(firstComment)}`);
      }
      lines.push("");

      for (const comment of threadComments) {
        const author = comment.author?.username || "unknown";
        const timestamp = formatTimestamp(comment.created_at);
        const systemBadge = comment.system ? " 🤖 _system_" : "";

        lines.push(`**@${author}**${systemBadge} • ${timestamp}`);
        lines.push("");
        lines.push(comment.body);
        lines.push("");
        lines.push("---");
        lines.push("");
      }
    }
  }

  // Render standalone notes
  if (standaloneNotes.length > 0) {
    lines.push("## 📝 Overview Notes");
    lines.push("");

    for (const note of standaloneNotes) {
      const author = note.author?.username || "unknown";
      const timestamp = formatTimestamp(note.created_at);
      const systemBadge = note.system ? " 🤖 _system_" : "";

      lines.push(`**@${author}**${systemBadge} • ${timestamp}`);
      lines.push("");
      lines.push(note.body);
      lines.push("");
      lines.push("---");
      lines.push("");
    }
  }

  return lines.join("\n");
}
