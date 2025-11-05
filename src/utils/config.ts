/**
 * Configuration module
 * Loads and validates environment variables
 */

export interface Config {
  gitlabBaseUrl: string;
  gitlabToken: string;
  logLevel: "DEBUG" | "INFO" | "WARN" | "ERROR";
  requestTimeout: number;
  maxRetries: number;
  logPayloads: boolean;
}

export function loadConfig(): Config {
  const token = process.env.GITLAB_TOKEN;
  if (!token) {
    throw new Error(
      "GITLAB_TOKEN environment variable is required. " +
        "Create a Personal Access Token with 'read_api' scope from GitLab."
    );
  }

  const logLevel = (process.env.LOG_LEVEL?.toUpperCase() || "INFO") as Config["logLevel"];
  if (!["DEBUG", "INFO", "WARN", "ERROR"].includes(logLevel)) {
    throw new Error(`Invalid LOG_LEVEL: ${logLevel}. Must be DEBUG, INFO, WARN, or ERROR.`);
  }

  return {
    gitlabBaseUrl: process.env.GITLAB_BASE_URL || "https://gitlab.com",
    gitlabToken: token,
    logLevel,
    requestTimeout: parseInt(process.env.REQUEST_TIMEOUT || "20000", 10),
    maxRetries: parseInt(process.env.MAX_RETRIES || "3", 10),
    logPayloads: process.env.LOG_PAYLOADS === "true",
  };
}
