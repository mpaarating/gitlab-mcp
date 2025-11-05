import { describe, it, expect, vi } from "vitest";
import { retryWithBackoff } from "../../src/utils/retry.js";
import type { Logger } from "../../src/utils/logger.js";

describe("retry", () => {
  const mockLogger: Logger = {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };

  describe("retryWithBackoff", () => {
    it("should succeed on first attempt", async () => {
      const fn = vi.fn().mockResolvedValue("success");

      const result = await retryWithBackoff(fn, {
        maxAttempts: 3,
        baseDelay: 100,
        maxDelay: 5000,
        logger: mockLogger,
      });

      expect(result).toBe("success");
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it("should retry on retryable errors (429)", async () => {
      const fn = vi
        .fn()
        .mockRejectedValueOnce({ status: 429 })
        .mockRejectedValueOnce({ status: 500 })
        .mockResolvedValue("success");

      const result = await retryWithBackoff(fn, {
        maxAttempts: 3,
        baseDelay: 10,
        maxDelay: 100,
        logger: mockLogger,
      });

      expect(result).toBe("success");
      expect(fn).toHaveBeenCalledTimes(3);
    });

    it("should throw after max attempts for retryable errors", async () => {
      const fn = vi.fn().mockRejectedValue({ status: 500 });

      await expect(
        retryWithBackoff(fn, {
          maxAttempts: 3,
          baseDelay: 10,
          maxDelay: 100,
          logger: mockLogger,
        })
      ).rejects.toEqual({ status: 500 });

      expect(fn).toHaveBeenCalledTimes(3);
    });

    it("should not retry non-retryable errors", async () => {
      const fn = vi.fn().mockRejectedValue({ status: 404 });

      await expect(
        retryWithBackoff(fn, {
          maxAttempts: 3,
          baseDelay: 10,
          maxDelay: 100,
          logger: mockLogger,
        })
      ).rejects.toEqual({ status: 404 });

      expect(fn).toHaveBeenCalledTimes(1);
    });

    it("should apply exponential backoff with delays", async () => {
      const fn = vi.fn().mockRejectedValue({ status: 500 });
      const startTime = Date.now();

      try {
        await retryWithBackoff(fn, {
          maxAttempts: 3,
          baseDelay: 100,
          maxDelay: 1000,
          logger: mockLogger,
        });
      } catch {
        // Expected to fail
      }

      const elapsed = Date.now() - startTime;

      // With baseDelay=100ms and 2 retries, expect at least 200ms total
      // (100ms after 1st retry, ~200ms after 2nd retry)
      expect(elapsed).toBeGreaterThan(200);
      expect(fn).toHaveBeenCalledTimes(3);
    });

    it("should log retry attempts", async () => {
      const fn = vi.fn().mockRejectedValue({ status: 429 });
      const logger = {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      };

      try {
        await retryWithBackoff(fn, {
          maxAttempts: 2,
          baseDelay: 10,
          maxDelay: 100,
          logger,
        });
      } catch {
        // Expected to fail
      }

      expect(logger.warn).toHaveBeenCalledWith(
        "Retrying request after error",
        expect.objectContaining({
          attempt: 1,
          maxAttempts: 2,
        })
      );
    });

    it("should handle 5xx server errors as retryable", async () => {
      const fn = vi.fn().mockRejectedValueOnce({ status: 503 }).mockResolvedValue("success");

      const result = await retryWithBackoff(fn, {
        maxAttempts: 2,
        baseDelay: 10,
        maxDelay: 100,
        logger: mockLogger,
      });

      expect(result).toBe("success");
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it("should pass correlation ID to logger", async () => {
      const fn = vi.fn().mockRejectedValue({ status: 429 });
      const logger = {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      };

      try {
        await retryWithBackoff(fn, {
          maxAttempts: 2,
          baseDelay: 10,
          maxDelay: 100,
          logger,
          correlationId: "test-123",
        });
      } catch {
        // Expected to fail
      }

      expect(logger.warn).toHaveBeenCalledWith(
        "Retrying request after error",
        expect.objectContaining({
          correlationId: "test-123",
        })
      );
    });
  });
});
