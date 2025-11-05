/**
 * Discussion fetcher service
 * Fetches all discussions (threaded inline comments) for a GitLab MR
 */

import { GitLabClient } from "./gitlab-client.js";
import { retryWithBackoff } from "../utils/retry.js";
import type { GitLabDiscussion } from "../types/gitlab.js";
import type { Config } from "../utils/config.js";
import type { Logger } from "../utils/logger.js";

export interface FetchDiscussionsOptions {
  project: string;
  mr: number;
  perPage: number;
}

/**
 * Fetch all discussions for a merge request with retry logic
 */
export async function fetchAllDiscussions(
  options: FetchDiscussionsOptions,
  config: Config,
  logger: Logger,
  correlationId: string
): Promise<GitLabDiscussion[]> {
  const client = new GitLabClient({
    baseUrl: config.gitlabBaseUrl,
    token: config.gitlabToken,
    timeout: config.requestTimeout,
    logger,
  });

  // URL-encode the project path to handle special characters
  const projectPath = encodeURIComponent(options.project);
  const path = `/projects/${projectPath}/merge_requests/${options.mr}/discussions`;

  logger.info("Fetching discussions", {
    project: options.project,
    mr: options.mr,
    correlationId,
  });

  // Wrap in retry logic for transient errors
  const discussions = await retryWithBackoff(
    () => client.getAllPages<GitLabDiscussion>(path, { per_page: options.perPage }, correlationId),
    {
      maxAttempts: config.maxRetries,
      baseDelay: 1000,
      maxDelay: 10000,
      logger,
      correlationId,
    }
  );

  logger.info("Discussions fetched successfully", {
    count: discussions.length,
    totalNotes: discussions.reduce((sum, d) => sum + d.notes.length, 0),
    correlationId,
  });

  return discussions;
}
