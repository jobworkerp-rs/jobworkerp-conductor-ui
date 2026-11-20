import { readFile } from "node:fs/promises"
import { deleteConfig, listConfig } from "../../src/lib/services/config"
import { localServerId } from "../../src/test/servers"
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

// The shared conductor is never overwritten or cleared here; see
// settings-clear.spec.ts for that, against its own conductor.
test.describe("Settings import and export", () => {
  let prefix: string
  test.beforeEach(() => {
    prefix = uniqueName("io")
  })
  test.afterEach(async () => {
    await cleanUpByPrefix(prefix)
  })

  test("downloads every setting as TOML", async ({ app }) => {
    await createScheduleViaApi(`${prefix}-nightly`, await localServerId(conductor))
    await app.goto("/settings")
    const section = app.getByRole("region", { name: "Export" })
    const [download] = await Promise.all([
      app.waitForEvent("download"),
      section.getByRole("button", { name: "Download TOML" }).click(),
    ])
    expect(download.suggestedFilename()).toMatch(/^conductor-settings-\d{8}-\d{6}\.toml$/)
    const toml = await readFile((await download.path())!, "utf8")
    expect(toml).toContain(`name = "${prefix}-nightly"`)
  })

  test("says which settings the file leaves out", async ({ app }) => {
    const server = await createServerViaApi(`${prefix}-gone`)
    await createScheduleViaApi(`${prefix}-orphan`, server)
    await deleteConfig(conductor, "servers", server)
    await app.goto("/settings")
    const [download] = await Promise.all([
      app.waitForEvent("download"),
      app
        .getByRole("region", { name: "Export" })
        .getByRole("button", { name: "Download TOML" })
        .click(),
    ])
    expect(await readFile((await download.path())!, "utf8")).not.toContain(`${prefix}-orphan`)
    await expect(app.getByText(/left out of the file/)).toBeVisible()
    await expect(app.getByText(`${prefix}-orphan`)).toBeVisible()
  })

  test("validates a file, then imports exactly what was validated", async ({ app }) => {
    await app.goto("/settings")
    const section = app.getByRole("region", { name: "Import" })
    const importButton = section.getByRole("button", { name: "Import", exact: true })
    await section.getByLabel("TOML", { exact: true }).fill(`
[[jobworkerp]]
name = "${prefix}-server"
address = "http://${prefix}.invalid:9000"

[[schedulers]]
name = "${prefix}-nightly"
jobworkerp = "${prefix}-server"
crontab = "0 0 3 * * *"
worker_name = "report"
description = "from the settings screen"
`)
    await expect(importButton).toBeDisabled()
    await section.getByRole("button", { name: "Validate" }).click()
    await expect(section.getByRole("status")).toContainText("1 schedule")
    await expect(importButton).toBeEnabled()

    await importButton.click()
    await expect(app.getByText(/^Imported 1 servers, 1 schedules/)).toBeVisible()
    const schedule = (await listConfig(conductor, "schedules")).find(
      (s) => s.data.name === `${prefix}-nightly`,
    )
    expect(schedule?.data.description).toBe("from the settings screen")
    await expectNoSeriousAxeViolations(app)
  })

  test("lists what cannot be imported", async ({ app }) => {
    await app.goto("/settings")
    const section = app.getByRole("region", { name: "Import" })
    await section.getByLabel("TOML", { exact: true }).fill(`
[[schedulers]]
name = "${prefix}-orphan"
jobworkerp = "${prefix}-missing"
crontab = "0 0 3 * * *"
worker_name = "report"
`)
    await section.getByRole("button", { name: "Validate" }).click()
    await expect(section.getByRole("alert")).toContainText(`${prefix}-missing`)
    await expect(section.getByRole("button", { name: "Import", exact: true })).toBeDisabled()
  })

  test("keeps Delete all settings disabled until DELETE is typed", async ({ app }) => {
    await app.goto("/settings")
    await app
      .getByRole("region", { name: "Danger zone" })
      .getByRole("button", { name: "Delete all settings" })
      .click()
    const dialog = app.getByRole("alertdialog")
    const confirm = dialog.getByRole("button", { name: "Delete all settings" })
    await expect(confirm).toBeDisabled()
    await dialog.getByLabel("Type DELETE to confirm").fill("DELETE")
    await expect(confirm).toBeEnabled()
    await expectNoSeriousAxeViolations(app)
    await dialog.getByRole("button", { name: "Cancel" }).click()
    await expect(dialog).toBeHidden()
  })
})
