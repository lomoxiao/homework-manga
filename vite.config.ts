import { defineConfig } from "vitest/config";

export default defineConfig({
  base: "./",
  server: { port: 4174 },
  test: { environment: "node", globals: true }
});
