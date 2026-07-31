import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
    globals: false,
    include: ["src/lib/__tests__/**/*.test.ts"],
    env: {
      STORE_MODE: "json",
      VERCEL: "1",
      AGENT_LOG_DEBUG: "0",
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
    },
  },
});
