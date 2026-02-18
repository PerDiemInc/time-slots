import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    include: ["test/**/*.spec.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      include: ["src/**/*.ts"],
      exclude: ["**/*.spec.ts", "**/index.ts"],
    },
  },
  resolve: {
    alias: {
      "@": "./src",
    },
  },
});
