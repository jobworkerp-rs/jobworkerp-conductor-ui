import { localServerId } from "../../src/test/servers"
import { createSleepWorker, sleepArgs } from "../../src/test/workers"
import {
  cleanUpByPrefix,
  conductor,
  createScheduleViaApi,
  expect,
  expectNoSeriousAxeViolations,
  jobworkerp,
  test,
  uniqueName,
} from "./fixtures"

test.describe("Executions", () => {
  let prefix: string
  test.beforeEach(() => {
    prefix = uniqueName("exec")
  })
  test.afterEach(async () => {
    await cleanUpByPrefix(prefix)
  })

  /** A schedule whose runs sleep a few seconds on a COMMAND worker. */
  async function sleepingSchedule(name: string, seconds = 3) {
    const worker = `${prefix}-sleep`
    await createSleepWorker(jobworkerp, worker)
    await createScheduleViaApi(name, await localServerId(conductor), {
      target: { workerName: worker, args: sleepArgs(seconds) },
    })
  }

  test("follows a manual run from the schedule to its end", async ({ app }) => {
    const name = `${prefix}-run`
    await sleepingSchedule(name)
    await app.goto("/schedules")
    await app.getByRole("button", { name: `Run ${name} now` }).click()
    await app.getByRole("button", { name: "Run", exact: true }).click()
    await app.getByRole("link", { name: "View the execution" }).click()

    await expect(app.getByRole("heading", { name: "Execution details" })).toBeVisible()
    await expect(app.getByRole("link", { name, exact: true })).toBeVisible()
    await expect(app.getByText("Running", { exact: true })).toBeVisible()
    // Polled every few seconds while it runs, until it ends.
    await expect(app.getByText("Succeeded", { exact: true })).toBeVisible({ timeout: 15_000 })
    const jobResult = app
      .locator("[data-slot=card]")
      .filter({ has: app.getByRole("heading", { name: "Job result" }) })
    await expect(jobResult.getByText("SUCCESS")).toBeVisible()
    await expectNoSeriousAxeViolations(app)
  })

  test("opens a schedule's history filtered to it, and deletes from there", async ({ app }) => {
    const name = `${prefix}-history`
    await sleepingSchedule(name, 1)
    await app.goto("/schedules")
    await app.getByRole("button", { name: `Run ${name} now` }).click()
    await app.getByRole("button", { name: "Run", exact: true }).click()
    const row = app.getByRole("row").filter({ hasText: name })
    // The latest-run column follows the run without opening it.
    await expect(row.getByText("Succeeded")).toBeVisible({ timeout: 15_000 })

    await row.getByRole("link", { name: `Executions of ${name}` }).click()
    await expect(app).toHaveURL(/\/executions\?sourceType=schedule&sourceId=\d+$/)
    await expect(app.getByText(`Started by: ${name} (Schedule)`)).toBeVisible()
    await expect(app.getByLabel("Period")).toBeDisabled()
    const execution = app.getByRole("row").filter({ hasText: "Succeeded" })
    await expect(execution).toHaveCount(1)
    await expectNoSeriousAxeViolations(app)

    await execution.getByRole("button", { name: /^Actions for execution/ }).click()
    await app.getByRole("menuitem", { name: "Delete" }).click()
    await app.getByRole("alertdialog").getByRole("button", { name: "Delete" }).click()
    await expect(app.getByText("Deleted", { exact: true })).toBeVisible()
    await expect(app.getByRole("row").filter({ hasText: "Succeeded" })).toHaveCount(0)
  })

  test("re-runs a schedule's execution from its detail", async ({ app }) => {
    const name = `${prefix}-again`
    await sleepingSchedule(name, 1)
    await app.goto("/schedules")
    await app.getByRole("button", { name: `Run ${name} now` }).click()
    await app.getByRole("button", { name: "Run", exact: true }).click()
    await app.getByRole("link", { name: "View the execution" }).click()
    await expect(app.getByRole("heading", { name: "Execution details" })).toBeVisible()

    await app.getByRole("button", { name: /^Actions for execution/ }).click()
    await app.getByRole("menuitem", { name: "Re-run" }).click()
    const dialog = app.getByRole("alertdialog", { name: `Re-run ${name}?` })
    await expect(dialog).toContainText("current settings")
    await dialog.getByRole("button", { name: "Re-run" }).click()
    await expect(app.getByText(`${name} accepted for a run`, { exact: true })).toBeVisible()
  })
})
