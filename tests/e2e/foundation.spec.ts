import { PREFERENCE_KEYS } from "../../src/lib/preferences"
import {
  CONDUCTOR_URL,
  expect,
  expectNoSeriousAxeViolations,
  serveRuntimeConfig,
  test,
} from "./fixtures"

test.describe("layout and navigation", () => {
  test("shows every screen of the spec from the sidebar", async ({ app }) => {
    await app.goto("/")
    await expect(app.getByRole("heading", { name: "Dashboard" })).toBeVisible()
    const screens = [
      "Servers",
      "Schedules",
      "Result Handlers",
      "Slack Events",
      "Executions",
      "Settings",
    ]
    for (const name of screens) {
      await app.getByRole("link", { name, exact: true }).click()
      await expect(app.getByRole("heading", { name })).toBeVisible()
    }
  })

  test("reports that the real conductor is reachable", async ({ app }) => {
    await app.goto("/")
    await expect(app.getByText("Connected to the conductor API")).toBeVisible()
    await expect(app.getByRole("alert")).toHaveCount(0)
  })

  test("links to the admin-ui of configured servers in a new tab", async ({ app }) => {
    await app.goto("/")
    const link = app.getByRole("link", { name: "local (opens in a new tab)" })
    await expect(link).toHaveAttribute("href", "http://127.0.0.1:5174")
    await expect(link).toHaveAttribute("target", "_blank")
  })

  test("shows a not-found page for unknown paths", async ({ app }) => {
    await app.goto("/no-such-page")
    await expect(app.getByRole("heading", { name: "Page not found" })).toBeVisible()
  })
})

test.describe("preferences", () => {
  test("switches the language without reloading and keeps it on the next visit", async ({
    app,
  }) => {
    await app.goto("/servers")
    await app.getByRole("button", { name: "Change language" }).click()
    await app.getByRole("menuitem", { name: "日本語" }).click()
    await expect(app.getByRole("heading", { name: "サーバー" })).toBeVisible()
    await expect(app.locator("html")).toHaveAttribute("lang", "ja")
    await app.reload()
    await expect(app.getByRole("heading", { name: "サーバー" })).toBeVisible()
  })

  test("switches the theme and keeps it on the next visit", async ({ app }) => {
    await app.goto("/")
    await app.getByRole("button", { name: "Change theme" }).click()
    await app.getByRole("menuitem", { name: "Dark" }).click()
    await expect(app.locator("html")).toHaveClass(/dark/)
    await app.reload()
    await expect(app.locator("html")).toHaveClass(/dark/)
  })

  test("uses the deployment's default language when the user has not chosen one", async ({
    page,
  }) => {
    await serveRuntimeConfig(page, {
      conductorUrl: CONDUCTOR_URL,
      defaultLanguage: "ja",
    })
    await page.goto("/")
    await expect(page.getByRole("heading", { name: "ダッシュボード" })).toBeVisible()
  })
})

test.describe("errors", () => {
  test("shows a banner with a retry button when conductor cannot be reached", async ({ page }) => {
    await serveRuntimeConfig(page, { conductorUrl: "http://127.0.0.1:9" })
    await page.goto("/")
    const banner = page.getByRole("alert")
    await expect(banner).toContainText("Cannot reach the conductor API")
    await expect(banner).toContainText("http://127.0.0.1:9")
    await expect(banner.getByRole("button", { name: "Retry" })).toBeVisible()
  })

  test("refuses to start with an invalid runtime configuration", async ({ page }) => {
    await serveRuntimeConfig(page, { conductorUrl: "ftp://example.com" })
    await page.goto("/")
    await expect(
      page.getByRole("heading", { name: "The runtime configuration is invalid" }),
    ).toBeVisible()
    await expect(page.getByText("conductor API URL: specify an http or https URL")).toBeVisible()
  })
})

test.describe("accessibility", () => {
  for (const theme of ["light", "dark"] as const) {
    test(`has no serious axe violations in the ${theme} theme`, async ({ app }) => {
      await app.addInitScript(([key, value]) => window.localStorage.setItem(key, value), [
        PREFERENCE_KEYS.theme,
        theme,
      ] as const)
      await app.goto("/")
      await expect(app.getByText("Connected to the conductor API")).toBeVisible()
      await expectNoSeriousAxeViolations(app)
    })
  }
})
