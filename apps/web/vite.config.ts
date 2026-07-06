import { defineConfig } from "vite";
import preact from "@preact/preset-vite";

export default defineConfig({
  base: "./",
  envDir: "../..",
  plugins: [preact()],
  server: { port: 4174 }
});
