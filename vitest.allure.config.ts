import { defineConfig } from "vitest/config";

process.env.MOURA_ALLURE_METADATA = "true";

export default defineConfig({
  test: {
    reporters: [
      "default",
      ["allure-vitest/reporter", { resultsDir: "allure-results" }],
    ],
  },
});
