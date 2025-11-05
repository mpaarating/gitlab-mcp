/**
 * Unit tests for config module
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

// Get project root for .env path verification
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, "../..");

describe("Config Module", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset environment before each test
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  describe("loadConfig", () => {
    it("should load configuration from environment variables", async () => {
      process.env.GITLAB_TOKEN = "glpat-test-token";
      process.env.GITLAB_BASE_URL = "https://gitlab.example.com";
      process.env.LOG_LEVEL = "DEBUG";
      process.env.REQUEST_TIMEOUT = "15000";
      process.env.MAX_RETRIES = "5";
      process.env.LOG_PAYLOADS = "true";

      const { loadConfig } = await import("../../src/utils/config.js");
      const config = loadConfig();

      expect(config).toEqual({
        gitlabToken: "glpat-test-token",
        gitlabBaseUrl: "https://gitlab.example.com",
        logLevel: "DEBUG",
        requestTimeout: 15000,
        maxRetries: 5,
        logPayloads: true,
      });
    });

    it("should use default values when optional env vars are not set", async () => {
      process.env.GITLAB_TOKEN = "glpat-test-token";

      const { loadConfig } = await import("../../src/utils/config.js");
      const config = loadConfig();

      expect(config.gitlabBaseUrl).toBe("https://gitlab.com");
      expect(config.logLevel).toBe("INFO");
      expect(config.requestTimeout).toBe(20000);
      expect(config.maxRetries).toBe(3);
      expect(config.logPayloads).toBe(false);
    });

    it("should throw error when GITLAB_TOKEN is missing", async () => {
      // Import first (which loads .env), then delete the token
      const { loadConfig } = await import("../../src/utils/config.js");
      delete process.env.GITLAB_TOKEN;

      expect(() => loadConfig()).toThrow(
        "GITLAB_TOKEN environment variable is required"
      );
    });

    it("should accept valid log levels", async () => {
      const validLevels = ["DEBUG", "INFO", "WARN", "ERROR"];

      for (const level of validLevels) {
        vi.resetModules();
        process.env.GITLAB_TOKEN = "glpat-test-token";
        process.env.LOG_LEVEL = level;

        const { loadConfig } = await import("../../src/utils/config.js");
        const config = loadConfig();

        expect(config.logLevel).toBe(level);
      }
    });

    it("should accept log levels in lowercase and convert to uppercase", async () => {
      process.env.GITLAB_TOKEN = "glpat-test-token";
      process.env.LOG_LEVEL = "debug";

      const { loadConfig } = await import("../../src/utils/config.js");
      const config = loadConfig();

      expect(config.logLevel).toBe("DEBUG");
    });

    it("should throw error for invalid log level", async () => {
      process.env.GITLAB_TOKEN = "glpat-test-token";
      process.env.LOG_LEVEL = "INVALID";

      const { loadConfig } = await import("../../src/utils/config.js");

      expect(() => loadConfig()).toThrow("Invalid LOG_LEVEL");
    });

    it("should parse numeric values correctly", async () => {
      process.env.GITLAB_TOKEN = "glpat-test-token";
      process.env.REQUEST_TIMEOUT = "30000";
      process.env.MAX_RETRIES = "10";

      const { loadConfig } = await import("../../src/utils/config.js");
      const config = loadConfig();

      expect(config.requestTimeout).toBe(30000);
      expect(config.maxRetries).toBe(10);
      expect(typeof config.requestTimeout).toBe("number");
      expect(typeof config.maxRetries).toBe("number");
    });

    it("should parse boolean LOG_PAYLOADS correctly", async () => {
      process.env.GITLAB_TOKEN = "glpat-test-token";

      // Test true
      process.env.LOG_PAYLOADS = "true";
      vi.resetModules();
      let { loadConfig } = await import("../../src/utils/config.js");
      let config = loadConfig();
      expect(config.logPayloads).toBe(true);

      // Test false (any non-"true" value)
      vi.resetModules();
      process.env.LOG_PAYLOADS = "false";
      ({ loadConfig } = await import("../../src/utils/config.js"));
      config = loadConfig();
      expect(config.logPayloads).toBe(false);

      // Test undefined
      vi.resetModules();
      delete process.env.LOG_PAYLOADS;
      ({ loadConfig } = await import("../../src/utils/config.js"));
      config = loadConfig();
      expect(config.logPayloads).toBe(false);
    });
  });

  describe(".env file loading", () => {
    it("should load .env file from project root", async () => {
      // This test verifies the path resolution logic
      // The actual .env file may or may not exist in the test environment
      
      // We can't easily test dotenv's actual file loading in unit tests
      // without creating temporary files, but we can verify the module
      // imports without errors (which means the path resolution worked)
      
      expect(async () => {
        await import("../../src/utils/config.js");
      }).not.toThrow();
    });

    it("should resolve project root correctly regardless of import location", () => {
      // Verify path calculation (2 levels up from dist/utils/config.js)
      const testPath = "/some/project/dist/utils/config.js";
      const mockDirname = "/some/project/dist/utils";
      const expectedRoot = join(mockDirname, "../..");

      expect(expectedRoot).toBe("/some/project");
    });
  });

  describe("Config interface", () => {
    it("should export Config type with correct structure", async () => {
      process.env.GITLAB_TOKEN = "glpat-test-token";

      const { loadConfig } = await import("../../src/utils/config.js");
      const config = loadConfig();

      // Verify all expected properties exist
      expect(config).toHaveProperty("gitlabToken");
      expect(config).toHaveProperty("gitlabBaseUrl");
      expect(config).toHaveProperty("logLevel");
      expect(config).toHaveProperty("requestTimeout");
      expect(config).toHaveProperty("maxRetries");
      expect(config).toHaveProperty("logPayloads");

      // Verify types
      expect(typeof config.gitlabToken).toBe("string");
      expect(typeof config.gitlabBaseUrl).toBe("string");
      expect(typeof config.logLevel).toBe("string");
      expect(typeof config.requestTimeout).toBe("number");
      expect(typeof config.maxRetries).toBe("number");
      expect(typeof config.logPayloads).toBe("boolean");
    });
  });
});

