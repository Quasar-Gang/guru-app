import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

// Unit tests cover the engines only. The pages are presentation over these.
export default defineConfig({
  resolve: { alias: { "@": resolve(import.meta.dirname, ".") } },
  test: { include: ["tests/**/*.test.ts"], environment: "node" },
});
