/**
 * Structured logging module with secret redaction
 */

import type { Config } from "./config.js";

export interface Logger {
  debug(message: string, meta?: Record<string, unknown>): void;
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
}

const SECRET_FIELDS = [
  "token",
  "password",
  "secret",
  "apikey",
  "api_key",
  "private-token",
  "private_token",
  "authorization",
];

/**
 * Recursively redact sensitive fields in objects
 */
function redactSecrets(obj: unknown): unknown {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => redactSecrets(item));
  }

  if (typeof obj === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      const lowerKey = key.toLowerCase();
      if (SECRET_FIELDS.some((field) => lowerKey.includes(field))) {
        result[key] = "[REDACTED]";
      } else {
        result[key] = redactSecrets(value);
      }
    }
    return result;
  }

  return obj;
}

export function createLogger(config: Config): Logger {
  const logLevel = config.logLevel;
  const logLevels = ["DEBUG", "INFO", "WARN", "ERROR"];
  const currentLevelIndex = logLevels.indexOf(logLevel);

  function shouldLog(level: string): boolean {
    const levelIndex = logLevels.indexOf(level);
    return levelIndex >= currentLevelIndex;
  }

  function log(level: string, message: string, meta?: Record<string, unknown>): void {
    if (!shouldLog(level)) {
      return;
    }

    const redacted = meta ? redactSecrets(meta) : {};
    const entry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...(redacted as Record<string, unknown>),
    };

    // Log to stderr (best practice for structured logging)
    console.error(JSON.stringify(entry));
  }

  return {
    debug: (msg, meta) => log("DEBUG", msg, meta),
    info: (msg, meta) => log("INFO", msg, meta),
    warn: (msg, meta) => log("WARN", msg, meta),
    error: (msg, meta) => log("ERROR", msg, meta),
  };
}
