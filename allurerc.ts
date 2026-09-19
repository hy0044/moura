import { defineConfig } from "allure";

export default defineConfig({
  plugins: {
    awesome: {
      options: {
        groupBy: ["epic", "feature", "story"],
      },
    },
  },
});
