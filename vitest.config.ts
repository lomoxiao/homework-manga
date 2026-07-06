import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["packages/*/tests/**/*.test.ts", "apps/*/tests/**/*.test.ts"]
  }
});
