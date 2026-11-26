import path from "path"
import type { Plugin } from "vite"
import { defineConfig } from "vitest/config"
import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"

export default defineConfig({
  plugins: [react(), tailwindcss() as unknown as Plugin],
  // A release reads its settings from config.js only; a developer's .env
  // must not end up in the published bundle (scripts/build-release.sh).
  envDir: process.env.CONDUCTOR_UI_RELEASE_BUILD ? false : undefined,
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          environment: "jsdom",
          setupFiles: "./src/test/setup.ts",
          // Node 25+ defines its own localStorage global, which is unusable
          // without a backing file and hides jsdom's.
          execArgv: ["--no-experimental-webstorage"],
          include: ["src/**/*.test.{ts,tsx}", "scripts/**/*.test.ts"],
          exclude: ["src/**/*.integration.test.ts", "src/**/*.destructive.test.ts"],
        },
      },
      {
        // Runs against a real conductor and jobworkerp (scripts/test-env.sh).
        extends: true,
        test: {
          name: "integration",
          environment: "node",
          include: ["src/**/*.integration.test.ts"],
          testTimeout: 30_000,
        },
      },
      {
        // Clears and overwrites every setting, so it gets a conductor of its
        // own (scripts/test-env.sh, "clear") and runs one file at a time.
        extends: true,
        test: {
          name: "destructive",
          environment: "node",
          include: ["src/**/*.destructive.test.ts"],
          testTimeout: 30_000,
          fileParallelism: false,
        },
      },
    ],
  },
})
