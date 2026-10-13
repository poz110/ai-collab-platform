import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    testTimeout: 60_000, // PGlite 初始化与迁移需要数秒
    hookTimeout: 60_000,
  },
});
