/**
 * Retry logic with exponential backoff and jitter
 */

import type { Logger } from "./logger.js";

// Declare setTimeout from Node.js globals
declare const setTimeout: (callback: () => void, ms: number) => unknown;

export interface RetryOptions {
  maxAttempts: number;
  baseDelay: number;
  maxDelay: number;
  logger: Logger;
  correlationId?: string;
}

/**
 * Check if an error is retryable (429 or 5xx responses)
 */
function isRetryable(error: unknown): boolean {
  if (error && typeof error === "object" && "status" in error) {
    const status = (error as { status: number }).status;
    return status === 429 || status >= 500;
  }
  return false;
}

/**
 * Calculate exponential backoff with jitter
 */
function calculateBackoff(attempt: number, base: number, max: number): number {
  const exponential = Math.min(base * Math.pow(2, attempt - 1), max);
  const jitter = exponential * 0.1 * Math.random();
  return Math.floor(exponential + jitter);
}

/**
 * Sleep for a given number of milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}

/**
 * Retry a function with exponential backoff
 */
export async function retryWithBackoff<T>(fn: () => Promise<T>, options: RetryOptions): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= options.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      // Don't retry if not retryable or if this was the last attempt
      if (!isRetryable(error) || attempt === options.maxAttempts) {
        throw error;
      }

      const delay = calculateBackoff(attempt, options.baseDelay, options.maxDelay);
      options.logger.warn("Retrying request after error", {
        attempt,
        maxAttempts: options.maxAttempts,
        delayMs: delay,
        correlationId: options.correlationId,
        error: error instanceof Error ? error.message : String(error),
      });

      await sleep(delay);
    }
  }

  throw lastError;
}
