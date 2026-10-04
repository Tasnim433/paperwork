import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    // Tests never touch the database or a real AI provider: AI_PROVIDER=mock returns
    // fixed results for fixtures/letters. The other values only satisfy env validation.
    env: {
      AI_PROVIDER: "mock",
      DATABASE_URL: "postgresql://test:test@localhost:5432/test",
      BETTER_AUTH_SECRET: "test-secret-not-used-anywhere-000000000",
      TESSERACT_CACHE_DIR: ".data/tesseract",
    },
  },
});
