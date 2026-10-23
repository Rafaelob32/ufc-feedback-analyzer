import { defineConfig } from "@playwright/test";
import base from "./playwright.config.mjs";

export default defineConfig({
  ...base,
  testDir: "./tests/capacity",
  projects: [base.projects[0]],
  timeout: 60_000,
  use: { ...base.use, trace: "off" },
  outputDir: "test-results/capacity",
});
