import { CONDUCTOR_URL, expect, expectNoSeriousAxeViolations, test } from "./fixtures"

test.describe("Settings", () => {
  test("shows where the UI connects and whether each end answers", async ({ app }) => {
    await app.goto("/settings")
    const connections = app.getByRole("region", { name: "Connections" })
    await expect(connections.getByText(CONDUCTOR_URL, { exact: true })).toBeVisible()
    await expect(connections.getByText("Connected to the conductor API")).toBeVisible()
    const local = connections.getByRole("row", { name: /local/ })
    await expect(local.getByText("Reachable", { exact: true })).toBeVisible()
    await expectNoSeriousAxeViolations(app)
  })

  test("keeps the display preferences across reloads", async ({ app }) => {
    await app.goto("/settings")
    await app.getByLabel("Auto refresh interval").selectOption("60")
    await app.getByLabel("Theme", { exact: true }).selectOption("dark")
    await expect(app.locator("html")).toHaveClass(/dark/)

    await app.reload()
    await expect(app.getByLabel("Auto refresh interval")).toHaveValue("60")
    await expect(app.locator("html")).toHaveClass(/dark/)
    await expectNoSeriousAxeViolations(app)
  })

  test("switches the language, or leaves it to the browser", async ({ app }) => {
    await app.goto("/settings")
    await app.getByLabel("Language", { exact: true }).selectOption("ja")
    await expect(app.getByRole("heading", { name: "設定", exact: true })).toBeVisible()

    await app.reload()
    await expect(app.getByRole("heading", { name: "設定", exact: true })).toBeVisible()
    await app.getByLabel("言語", { exact: true }).selectOption("browser")
    // Playwright's browser runs in English (en-US).
    await expect(app.getByRole("heading", { name: "Settings", exact: true })).toBeVisible()

    await app.reload()
    await expect(app.getByLabel("Language", { exact: true })).toHaveValue("browser")
  })
})
