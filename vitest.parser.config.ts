import { defineConfig } from "vitest/config";
import path from "node:path";

/**
 * Bateria do parser contra a OpenAI de verdade (`npm run test:parser`).
 * Fica fora do `npm test`/CI: precisa de OPENAI_API_KEY e gasta chamadas de API.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
      "server-only": path.resolve(__dirname, "tests/stubs/server-only.ts"),
    },
  },
  test: {
    include: ["tests/parser/**/*.test.ts"],
    environment: "node",
    env: { TZ: "UTC" },
    testTimeout: 60_000,
    maxConcurrency: 6,
  },
});
