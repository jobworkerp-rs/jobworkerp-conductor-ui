import type { Page } from "@playwright/test"
import { listConfig } from "../../src/lib/services/config"
import { localServerId } from "../../src/test/servers"
import {
  cleanUpByPrefix,
  conductor,
  createScheduleViaApi,
  expect,
  expectNoSeriousAxeViolations,
  test,
  uniqueName,
} from "./fixtures"

const LIST = "/schedules"
// A worker conductor's all-in-one bootstrap registers, so runs are enqueued;
// its runner has several methods, so a run names one.
const WORKER = "conductor_cron-scheduler_find-list"
const USING = "unary"

test.describe("Schedules", () => {
  let prefix: string
  test.beforeEach(() => {
    prefix = uniqueName("sched")
  })
  test.afterEach(async () => {
    await cleanUpByPrefix(prefix)
  })

  async function startCreating(app: Page, name: string) {
    await app.goto(LIST)
    await app.getByRole("link", { name: "Create" }).click()
    await expect(app.getByRole("heading", { name: "Create schedule" })).toBeVisible()
    await app.getByLabel(/^Name/).fill(name)
    await app.getByLabel(/^Server/).selectOption({ label: "local" })
    await app.getByLabel(/^Worker name/).fill(WORKER)
  }

  const stored = async (name: string) =>
    (await listConfig(conductor, "schedules")).find((s) => s.data.name === name)?.data

  test("creates a schedule from a preset and lists its next run", async ({ app }) => {
    const name = `${prefix}-preset`
    await startCreating(app, name)
    await app.getByRole("button", { name: "Weekdays 9:00" }).click()
    const crontab = app.getByLabel(/^Cron expression/)
    await expect(crontab).toHaveValue("0 0 9 * * MON-FRI")
    await expect(app.getByText("At 09:00, Monday through Friday")).toBeVisible()
    // No cron time zone in the runtime config: computed in UTC, with a note.
    await expect(app.getByText("Next runs (UTC)")).toBeVisible()
    await expect(app.getByText(/may differ from conductor's/)).toBeVisible()
    await expectNoSeriousAxeViolations(app)
    await app.getByRole("button", { name: "Save" }).click()

    const row = app.getByRole("row").filter({ hasText: name })
    await expect(row).toContainText("0 0 9 * * MON-FRI")
    await expect(row).toContainText("At 09:00, Monday through Friday")
    await expect(row.getByRole("cell").nth(2)).toHaveText(/\d{2}\/\d{2}\/\d{4}, 09:00:00 UTC/)
    await expect(app.getByText("Runs are shown in the cron time zone, UTC.")).toBeVisible()
    await expectNoSeriousAxeViolations(app)
  })

  test("saves a five-field expression with a seconds field added", async ({ app }) => {
    const name = `${prefix}-five`
    await startCreating(app, name)
    await app.getByLabel(/^Cron expression/).fill("30 9 * * *")
    await expect(app.getByText(/saved as "0 30 9 \* \* \*"/)).toBeVisible()
    await app.getByRole("button", { name: "Save" }).click()
    await expect(app.getByRole("row").filter({ hasText: name })).toBeVisible()
    expect((await stored(name))?.crontab).toBe("0 30 9 * * *")
  })

  test("refuses an expression conductor cannot schedule", async ({ app }) => {
    const name = `${prefix}-invalid`
    await startCreating(app, name)
    const crontab = app.getByLabel(/^Cron expression/)
    await crontab.fill("0 0 24 * * *")
    await expect(app.getByText(/conductor cannot schedule this expression/)).toBeVisible()
    await app.getByRole("button", { name: "Save" }).click()
    await expect(crontab).toHaveAttribute("aria-invalid", "true")
    await expect(crontab).toHaveAccessibleDescription(/conductor cannot use this cron expression/)
    await expect(app.getByRole("heading", { name: "Create schedule" })).toBeVisible()
    expect(await stored(name)).toBeUndefined()
  })

  test("runs a disabled schedule now with args for that run only", async ({ app }) => {
    const name = `${prefix}-run`
    await createScheduleViaApi(name, await localServerId(conductor), {
      target: { workerName: WORKER, using: USING },
    })
    await app.goto(LIST)
    await app.getByRole("button", { name: `Run ${name} now` }).click()
    const dialog = app.getByRole("alertdialog", { name: `Run ${name} now?` })
    await expect(dialog).toContainText(`Worker: ${WORKER}`)
    await expect(dialog).toContainText("This schedule is disabled")
    await dialog.getByLabel("Replace the args for this run only").check()
    await dialog.getByRole("textbox", { name: "Args for this run" }).fill("{}")
    await expectNoSeriousAxeViolations(app)
    await dialog.getByRole("button", { name: "Run" }).click()

    await expect(app.getByText(`${name} accepted for a run`, { exact: true })).toBeVisible()
    await app.getByRole("link", { name: "View the execution" }).click()
    await expect(app).toHaveURL(/\/executions\/\d+$/)
    await expect(app.getByText(`${name} accepted for a run`, { exact: true })).toHaveCount(0)
  })

  test("reports a run conductor could not enqueue until it is followed", async ({ app }) => {
    const name = `${prefix}-unqueued`
    // The default worker does not exist, so conductor records the run but cannot enqueue it.
    await createScheduleViaApi(name, await localServerId(conductor))
    await app.goto(LIST)
    await app.getByRole("button", { name: `Run ${name} now` }).click()
    await app.getByRole("button", { name: "Run", exact: true }).click()

    const failure = app.getByText(`${name} could not be run`, { exact: true })
    await expect(failure).toBeVisible()
    await expect(app.getByRole("region", { name: /Notifications/ })).toContainText(/e2e-worker/)
    await app.getByRole("link", { name: "View the execution" }).click()
    await expect(app).toHaveURL(/\/executions\/\d+$/)
    await expect(failure).toHaveCount(0)
  })

  test("tells a schedule conductor cannot run from one without a next run", async ({ app }) => {
    const serverId = await localServerId(conductor)
    const refused = `${prefix}-refused`
    // Saved past the UI, as conductor stores any expression without checking it.
    await createScheduleViaApi(refused, serverId, {
      crontab: "0 0 24 * * *",
      enabled: true,
    })
    const past = `${prefix}-past`
    await createScheduleViaApi(past, serverId, {
      crontab: "0 0 0 1 1 * 2020",
      enabled: true,
    })
    await app.goto(LIST)
    await expect(app.getByRole("row").filter({ hasText: refused })).toContainText(
      "conductor cannot schedule this expression",
    )
    await expect(app.getByRole("row").filter({ hasText: past })).toContainText("No run time found")
  })

  test("says when conductor's cron rules cannot be loaded, and retries", async ({ app }) => {
    await createScheduleViaApi(`${prefix}-unloaded`, await localServerId(conductor), {
      enabled: true,
    })
    // A network fault for the module's download only (not the dev server's
    // "?import" module that names it); the API is untouched.
    const download = (url: URL) => url.pathname.endsWith("/cron.wasm") && url.search === ""
    await app.route(download, (route) => route.fulfill({ status: 404 }))
    await app.goto(LIST)
    await expect(app.getByText(/next runs cannot be shown/)).toBeVisible()
    await app.unroute(download)
    await app.getByRole("button", { name: "Retry" }).click()
    await expect(app.getByText(/next runs cannot be shown/)).toHaveCount(0)
    await expect(app.getByText(/Next run: \d/)).toBeVisible()
  })
})
