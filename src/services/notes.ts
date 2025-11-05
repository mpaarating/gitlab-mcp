/**
 * Notes fetcher service
 * Fetches all overview notes (non-threaded comments) for a GitLab MR
 */

import { GitLabClient } from "./gitlab-client.js";
import { retryWithBackoff } from "../utils/retry.js";
import type { GitLabNote } from "../types/gitlab.js";
import type { Config } from "../utils/config.js";
import type { Logger } from "../utils/logger.js";

export interface FetchNotesOptions {
  project: string;
  mr: number;
  perPage: number;
}

/**
 * Fetch all overview notes for a merge request with retry logic
 */
export async function fetchAllNotes(
  options: FetchNotesOptions,
  config: Config,
  logger: Logger,
  correlationId: string
): Promise<GitLabNote[]> {
  const client = new GitLabClient({
    baseUrl: config.gitlabBaseUrl,
    token: config.gitlabToken,
    timeout: config.requestTimeout,
    logger,
  });

  // URL-encode the project path to handle special characters
  const projectPath = encodeURIComponent(options.project);
  const path = `/projects/${projectPath}/merge_requests/${options.mr}/notes`;

  logger.info("Fetching overview notes", {
    project: options.project,
    mr: options.mr,
    correlationId,
  });

  // Wrap in retry logic for transient errors
  const notes = await retryWithBackoff(
    () => client.getAllPages<GitLabNote>(path, { per_page: options.perPage }, correlationId),
    {
      maxAttempts: config.maxRetries,
      baseDelay: 1000,
      maxDelay: 10000,
      logger,
      correlationId,
    }
  );

  logger.info("Overview notes fetched successfully", {
    count: notes.length,
    correlationId,
  });

  return notes;
}
