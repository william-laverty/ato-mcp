import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Each test file gets its own module context so handler-level module
    // singletons (store, embedder) are re-created between test suites.
    pool: "forks",
    poolOptions: {
      forks: { singleFork: false },
    },
    // Ensure test environment has access to Node globals (fetch, Response, etc.)
    environment: "node",
  },
});
