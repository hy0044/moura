import eslint from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "node_modules/",
      "dist/",
      "coverage/",
      "allure-results/",
      "allure-report/",
      "_site/",
    ],
  },
  eslint.configs.recommended,
  tseslint.configs.recommended,
);
