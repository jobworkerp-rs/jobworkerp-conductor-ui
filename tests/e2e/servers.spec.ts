import { findEntity } from "../../src/lib/entities"
import { listConfig } from "../../src/lib/services/config"
import {
  cleanUpByPrefix,
  conductor,
  createScheduleViaApi,
  createServerViaApi,
  expect,
  expectNoSeriousAxeViolations,
  test,
  uniqueName,
} from "./fixtures"

test.describe("servers", () => {
  let prefix: string
  test.beforeEach(() => {
    prefix = uniqueName("srv")
  })
  test.afterEach(async () => {
    await cleanUpByPrefix(prefix)
  })

  test("creates a server and shows it in the list and the detail page", async ({ app }) => {
    const name = `${prefix}-created`
    await app.goto("/servers")
    await app.getByRole("link", { name: "Create" }).click()
    await expect(app.getByRole("heading", { name: "Create server" })).toBeVisible()
    await app.getByLabel(/^Name/).fill(name)
    await app.getByLabel(/^Host/).fill("jobworkerp.internal")
    await app.getByLabel(/^Port/).fill("9443")
    await app.getByRole("switch", { name: "Use SSL/TLS" }).click()
    await app.getByLabel("Description").fill("created by e2e")
    await app.getByRole("button", { name: "Save" }).click()

    await expect(app.getByRole("heading", { name })).toBeVisible()
    await expect(app.getByText("https://jobworkerp.internal:9443")).toBeVisible()
    await expect(app.getByText("Not linked")).toBeVisible()
    await expect(app.getByText("No configuration uses this server.")).toBeVisible()

    await app.getByRole("link", { name: "Servers", exact: true }).click()
    const row = app.getByRole("row").filter({ hasText: name })
    await expect(row).toContainText("https://jobworkerp.internal:9443")
    await expect(row).toContainText("created by e2e")
  })

  test("rejects invalid input before sending it", async ({ app }) => {
    await app.goto("/servers/new")
    await app.getByLabel(/^Port/).fill("70000")
    await app.getByRole("button", { name: "Save" }).click()
    await expect(app.getByLabel(/^Port/)).toHaveAttribute("aria-invalid", "true")
    await expect(app.getByText("Enter a whole number from 1 to 65535")).toBeVisible()
    await expect(app.getByRole("heading", { name: "Create server" })).toBeVisible()
  })

  test("reports a duplicate name from the server", async ({ app }) => {
    const name = `${prefix}-dup`
    await createServerViaApi(name)
    await app.goto("/servers/new")
    await app.getByLabel(/^Name/).fill(name)
    await expect(app.getByText("already used by another server")).toBeVisible()
    await app.getByLabel(/^Host/).fill("h")
    await app.getByRole("button", { name: "Save" }).click()
    await expect(
      app.getByText("A configuration with the same name already exists", { exact: true }),
    ).toBeVisible()
  })

  test("edits a server", async ({ app }) => {
    const name = `${prefix}-edit`
    const id = await createServerViaApi(name)
    await app.goto(`/servers/${id}`)
    await app.getByRole("link", { name: "Edit" }).click()
    await expect(app.getByLabel(/^Name/)).toHaveValue(name)
    await app.getByLabel(/^Host/).fill("renamed-host")
    await app.getByRole("button", { name: "Save" }).click()
    await expect(app.getByText("http://renamed-host:9000")).toBeVisible()
  })

  test("toggles a server from the list", async ({ app }) => {
    const name = `${prefix}-toggle`
    const id = await createServerViaApi(name)
    await app.goto("/servers")
    const toggle = app.getByRole("switch", { name: `Enable or disable ${name}` })
    await expect(toggle).toBeChecked()
    await toggle.click()
    await expect(toggle).not.toBeChecked()
    await expect
      .poll(async () => findEntity(await listConfig(conductor, "servers"), id)?.data.enabled)
      .toBe(false)
  })

  test("warns before deleting a server that a schedule uses", async ({ app }) => {
    const name = `${prefix}-used`
    const id = await createServerViaApi(name)
    const schedule = `${prefix}-schedule`
    await createScheduleViaApi(schedule, id)

    await app.goto(`/servers/${id}`)
    await app.getByRole("link", { name: schedule }).click()
    await expect(app.getByRole("heading", { name: "Edit schedule" })).toBeVisible()

    await app.getByRole("link", { name: "Servers", exact: true }).click()
    await app.getByRole("button", { name: `Delete ${name}` }).click()
    const dialog = app.getByRole("alertdialog", { name: `Delete ${name}?` })
    await expect(dialog).toContainText("used by 1 configuration")
    await expect(dialog).toContainText(`Schedules: ${schedule}`)
    await dialog.getByRole("button", { name: "Cancel" }).click()
    await expect(app.getByRole("row").filter({ hasText: name })).toBeVisible()

    await app.getByRole("button", { name: `Delete ${name}` }).click()
    await app.getByRole("button", { name: "Delete anyway" }).click()
    await expect(app.getByRole("row").filter({ hasText: name })).toHaveCount(0)
  })

  test("deletes an unused server from its detail page", async ({ app }) => {
    const name = `${prefix}-unused`
    const id = await createServerViaApi(name)
    await app.goto(`/servers/${id}`)
    await app.getByRole("button", { name: "Delete" }).click()
    await expect(app.getByRole("alertdialog")).toContainText("This cannot be undone.")
    // Record every alert, so one that flashes before the navigation is caught.
    await app.evaluate(() => {
      const seen: string[] = []
      Object.assign(window, { seenAlerts: seen })
      new MutationObserver(() => {
        document.querySelectorAll("[role=alert]").forEach((el) => seen.push(el.textContent ?? ""))
      }).observe(document.body, { subtree: true, childList: true, characterData: true })
    })
    await app.getByRole("alertdialog").getByRole("button", { name: "Delete" }).click()
    await expect(app.getByRole("heading", { name: "Servers" })).toBeVisible()
    await expect(app.getByText("Server deleted", { exact: true })).toBeVisible()
    expect(findEntity(await listConfig(conductor, "servers"), id)).toBeUndefined()
    const alerts = await app.evaluate(
      () => (window as unknown as { seenAlerts: string[] }).seenAlerts,
    )
    expect(alerts.filter((text) => text.includes("was not found"))).toEqual([])
  })

  test("drops a row that someone else deleted when deleting it fails", async ({ app }) => {
    const name = `${prefix}-gone`
    const id = await createServerViaApi(name)
    await app.goto("/servers")
    await expect(app.getByRole("row").filter({ hasText: name })).toBeVisible()
    await conductor.jobworkerpServer.delete({ value: id })
    await app.getByRole("button", { name: `Delete ${name}` }).click()
    await app.getByRole("alertdialog").getByRole("button", { name: "Delete" }).click()
    await expect(app.getByText("The item was not found", { exact: true })).toBeVisible()
    // The open dialog hides the table from the accessibility tree.
    await app.getByRole("alertdialog").getByRole("button", { name: "Cancel" }).click()
    // Well before the 30-second poll would have caught up.
    await expect(app.getByRole("row").filter({ hasText: name })).toHaveCount(0)
  })

  test("warns about a reference added right after the list loaded", async ({ app }) => {
    const name = `${prefix}-late`
    const id = await createServerViaApi(name)
    await app.goto("/servers")
    await expect(app.getByRole("button", { name: `Delete ${name}` })).toBeEnabled()
    await createScheduleViaApi(`${prefix}-late-schedule`, id)
    await app.getByRole("button", { name: `Delete ${name}` }).click()
    await expect(app.getByRole("alertdialog")).toContainText("used by 1 configuration")
  })

  test("shows the jobworkerp status of a linked server", async ({ app }) => {
    await app.goto("/servers")
    await app.getByRole("link", { name: "local", exact: true }).click()
    await expect(app.getByRole("heading", { name: "local" })).toBeVisible()
    // Exact: "Reachable" is also a substring of "Unreachable".
    await expect(app.getByText("Reachable", { exact: true })).toBeVisible()
    // Other tests add and remove workers concurrently, so the exact figure is
    // checked by the integration test of fetchJobworkerpInfo instead.
    const workerStat = app
      .getByRole("term")
      .filter({ hasText: /^Workers$/ })
      .locator("xpath=following-sibling::dd")
    await expect(workerStat).toHaveText(/^[1-9][\d,]*$/)
    await expect(app.getByText("Workers by channel")).toBeVisible()
    await expect(app.getByRole("link", { name: "Workers (opens in a new tab)" })).toHaveAttribute(
      "href",
      "http://127.0.0.1:5174/workers",
    )
    await expectNoSeriousAxeViolations(app)
  })

  test("shows a not-found message for an unknown server", async ({ app }) => {
    await app.goto("/servers/1")
    await expect(app.getByText("Server 1 was not found")).toBeVisible()
  })

  for (const path of ["/servers", "/servers/new"]) {
    test(`has no serious axe violations on ${path}`, async ({ app }) => {
      await app.goto(path)
      await expect(app.getByText("Connected to the conductor API")).toBeVisible()
      await expect(app.getByText("Loading…")).toHaveCount(0)
      await expectNoSeriousAxeViolations(app)
    })
  }

  test("has no serious axe violations on a server detail page", async ({ app }) => {
    const id = await createServerViaApi(`${prefix}-axe`)
    await app.goto(`/servers/${id}`)
    await expect(app.getByText("No configuration uses this server.")).toBeVisible()
    await expectNoSeriousAxeViolations(app)
  })
})
