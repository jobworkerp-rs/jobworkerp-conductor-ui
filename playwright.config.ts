import { defineConfig, devices } from "@playwright/test"
import { BUILD_TIME_KEYS } from "./src/lib/runtime-config"

// A dedicated port so a running `pnpm dev` (5173) of this or another app does not clash.
const PORT = Number(process.env.E2E_PORT ?? 5287)
const BASE_URL = `http://localhost:${PORT}`

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? "list" : "html",
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: `pnpm dev --port ${PORT} --strictPort`,
    url: BASE_URL,
    // A developer's .env (e.g. a default language) must not change what the
    // tests see; Vite keeps variables already set, and empty counts as unset.
    // Each test serves its own runtime configuration instead.
    env: Object.fromEntries(Object.values(BUILD_TIME_KEYS).map((key) => [key, ""])),
    reuseExistingServer: !process.env.CI,
  },
})
