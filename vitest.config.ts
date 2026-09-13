import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: ["src/**/*.test.ts", "src/**/*.spec.ts", "src/test-support/**"],
      reporter: ["text", "text-summary", "json-summary", "html", "lcov"],
      reportsDirectory: "coverage",
    },
  },
});
