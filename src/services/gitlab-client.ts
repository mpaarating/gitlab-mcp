/**
 * GitLab API HTTP Client
 * 🔒 READ-ONLY: This client ONLY supports GET requests
 * NO write operations (POST/PUT/PATCH/DELETE) are implemented
 */

import { fetch } from "undici";
import type { Logger } from "../utils/logger.js";
import type { PaginationInfo } from "../types/gitlab.js";
import { GitLabError } from "../utils/errors.js";

export interface GitLabClientOptions {
  baseUrl: string;
  token: string;
  timeout?: number;
  logger: Logger;
}

export class GitLabClient {
  private baseUrl: string;
  private token: string;
  private timeout: number;
  private logger: Logger;

  constructor(options: GitLabClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, ""); // Remove trailing slash
    this.token = options.token;
    this.timeout = options.timeout || 20000;
    this.logger = options.logger;
  }

  /**
   * 🔒 READ-ONLY: Perform GET request to GitLab API
   * This is the ONLY HTTP method exposed by this client
   */
  async get<T>(
    path: string,
    queryParams?: Record<string, string | number>,
    correlationId?: string
  ): Promise<{ data: T; pagination: PaginationInfo }> {
    const url = this.buildUrl(path, queryParams);

    this.logger.debug("GitLab API request", {
      method: "GET",
      url: url.toString(),
      correlationId,
    });

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        method: "GET", // ✅ ONLY GET allowed
        headers: {
          "PRIVATE-TOKEN": this.token,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw await this.handleErrorResponse(response);
      }

      const data = (await response.json()) as T;
      const pagination = this.parsePaginationHeaders(response.headers);

      this.logger.debug("GitLab API response", {
        status: response.status,
        pagination,
        correlationId,
      });

      return { data, pagination };
    } catch (error) {
      clearTimeout(timeoutId);

      if ((error as Error).name === "AbortError") {
        throw new GitLabError(
          "Request timed out",
          "ETIMEDOUT",
          undefined,
          `Increase REQUEST_TIMEOUT (current: ${this.timeout}ms) or reduce request scope`
        );
      }

      throw error;
    }
  }

  /**
   * 🔒 READ-ONLY: Fetch all pages using GET requests
   * Automatically handles pagination until all data is retrieved
   */
  async getAllPages<T>(
    path: string,
    queryParams?: Record<string, string | number>,
    correlationId?: string
  ): Promise<T[]> {
    const results: T[] = [];
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const params = { ...queryParams, page: page.toString() };
      const { data, pagination } = await this.get<T[]>(path, params, correlationId);

      results.push(...data);

      if (pagination.nextPage !== null) {
        page = pagination.nextPage;
        this.logger.debug("Fetching next page", {
          currentPage: page - 1,
          nextPage: page,
          totalPages: pagination.totalPages,
          correlationId,
        });
      } else {
        hasMore = false;
      }
    }

    return results;
  }

  // 🔒 DELIBERATELY OMITTED: post(), put(), patch(), delete()
  // This class ONLY supports GET requests to prevent accidental writes

  /**
   * Build full URL with query parameters
   */
  private buildUrl(path: string, queryParams?: Record<string, string | number>): URL {
    // Ensure path starts with /api/v4
    const apiPath = path.startsWith("/api/v4") ? path : `/api/v4${path}`;
    const url = new URL(apiPath, this.baseUrl);

    if (queryParams) {
      for (const [key, value] of Object.entries(queryParams)) {
        url.searchParams.append(key, value.toString());
      }
    }

    return url;
  }

  /**
   * Parse GitLab pagination headers
   */
  private parsePaginationHeaders(headers: Headers): PaginationInfo {
    const nextPage = headers.get("x-next-page");
    const totalPages = headers.get("x-total-pages");
    const perPage = headers.get("x-per-page");
    const total = headers.get("x-total");

    return {
      nextPage: nextPage ? parseInt(nextPage, 10) : null,
      totalPages: totalPages ? parseInt(totalPages, 10) : null,
      perPage: perPage ? parseInt(perPage, 10) : 100,
      total: total ? parseInt(total, 10) : null,
    };
  }

  /**
   * Handle error responses from GitLab API
   */
  private async handleErrorResponse(response: Response): Promise<GitLabError> {
    let errorMessage = `GitLab API error: ${response.status} ${response.statusText}`;
    let remediation: string | undefined;

    try {
      const errorBody = await response.json();
      if (errorBody && typeof errorBody === "object" && "message" in errorBody) {
        errorMessage = `GitLab API error: ${errorBody.message}`;
      }
    } catch {
      // If response body is not JSON, use default message
    }

    // Add remediation hints for common errors
    if (response.status === 401 || response.status === 403) {
      remediation = "Verify GITLAB_TOKEN has 'read_api' scope and access to the project";
    } else if (response.status === 404) {
      remediation = "Check project path and MR IID (!number) are correct";
    } else if (response.status === 429) {
      remediation = "Reduce request frequency or use filters to limit data";
    }

    return new GitLabError(errorMessage, `HTTP_${response.status}`, response.status, remediation);
  }
}
