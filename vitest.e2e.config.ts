import { defineConfig } from "vitest/config";

// End-to-end browser tests: `npm run test:e2e`.
// A Vite dev server is started once by e2e/support/globalSetup.ts (or set
// E2E_BASE_URL to test an already-running server). Unit tests (`npm test`)
// do not pick these files up: they are named *.e2e.ts.
export default defineConfig({
  test: {
    include: ["e2e/**/*.e2e.ts"],
    globalSetup: ["e2e/support/globalSetup.ts"],
    // One headless browser at a time keeps memory use low and runs stable.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000, // first launch unpacks the bundled Chromium
  },
});
