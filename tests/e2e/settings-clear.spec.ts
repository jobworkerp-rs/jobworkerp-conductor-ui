import { createConductorClients } from "../../src/lib/clients"
import { listConfig } from "../../src/lib/services/config"
import { importConfig } from "../../src/lib/services/config-management"
import { TEST_CLEAR_CONDUCTOR_URL, TEST_CLEAR_JOBWORKERP_URL } from "../../src/test/endpoints"
import { expect, testWithConfig } from "./fixtures"

// Deletes every setting, so it runs against the conductor kept for that
// (scripts/test-env.sh, "clear"), one test at a time.
const conductor = createConductorClients(TEST_CLEAR_CONDUCTOR_URL)
const test = testWithConfig({
  conductorUrl: TEST_CLEAR_CONDUCTOR_URL,
  jobworkerpServers: JSON.stringify([{ name: "local", grpcWebUrl: TEST_CLEAR_JOBWORKERP_URL }]),
})
test.describe.configure({ mode: "serial" })

test("deletes every setting from the danger zone", async ({ app }) => {
  const imported = await importConfig(
    conductor,
    `
[[jobworkerp]]
name = "local"
address = "http://127.0.0.1:9000"

[[schedulers]]
name = "to-be-deleted"
jobworkerp = "local"
crontab = "0 0 3 * * *"
worker_name = "report"
`,
    true,
  )
  expect(imported.ok).toBe(true)

  await app.goto("/settings")
  await app
    .getByRole("region", { name: "Danger zone" })
    .getByRole("button", { name: "Delete all settings" })
    .click()
  const dialog = app.getByRole("alertdialog")
  await expect(dialog.getByText("Execution history is kept.")).toBeVisible()
  await dialog.getByLabel("Type DELETE to confirm").fill("DELETE")
  await dialog.getByRole("button", { name: "Delete all settings" }).click()
  await expect(app.getByText("All settings deleted", { exact: true })).toBeVisible()
  expect(await listConfig(conductor, "schedules")).toEqual([])
  expect(await listConfig(conductor, "servers")).toEqual([])
})
