import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html", "lcov"],
      exclude: [
        "node_modules/",
        "dist/",
        "**/*.test.ts",
        "**/*.spec.ts",
        "scripts/",
        "vitest.config.ts",
      ],
      thresholds: {
        lines: 35,
        functions: 65,
        branches: 70,
        statements: 35,
      },
    },
    include: ["tests/**/*.test.ts"],
  },
});
