/**
 * Comment filter and sorter
 * Applies filters and sorts comments chronologically
 */

import type { Comment, FilterOptions } from "../types/schemas.js";

/**
 * Apply filters to comments and sort chronologically
 */
export function applyFilters(comments: Comment[], options: FilterOptions): Comment[] {
  let filtered = [...comments];

  // Filter out system notes if requested
  if (!options.includeSystem) {
    filtered = filtered.filter((c) => !c.system);
  }

  // Filter by resolution status
  if (options.onlyUnresolved) {
    // Only show resolvable comments that are NOT resolved
    filtered = filtered.filter((c) => c.resolvable && c.resolved === false);
  } else if (options.onlyResolved) {
    // Only show resolvable comments that ARE resolved
    filtered = filtered.filter((c) => c.resolvable && c.resolved === true);
  }

  // Sort chronologically by creation time
  filtered.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  return filtered;
}
