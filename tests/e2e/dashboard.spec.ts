import { triggerSchedule } from "../../src/lib/services/executions"
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

test.describe("Dashboard", () => {
  let prefix: string
  test.beforeEach(() => {
    prefix = uniqueName("dash")
  })
  test.afterEach(async () => {
    await cleanUpByPrefix(prefix)
  })

  test("shows the counts, recent failures, next runs and servers", async ({ app }) => {
    const server = await localServerId(conductor)
    const due = `${prefix}-due`
    await createScheduleViaApi(due, server, { enabled: true })
    const broken = `${prefix}-broken`
    await createScheduleViaApi(broken, server)
    const brokenId = (await listConfig(conductor, "schedules")).find(
      (s) => s.data.name === broken,
    )!.id
    // The default worker does not exist, so this run fails to enqueue.
    await triggerSchedule(conductor, brokenId)

    await app.goto("/")
    await expect(app.getByRole("heading", { name: "Dashboard" })).toBeVisible()
    const recent = app.locator("[data-slot=card]").filter({
      has: app.getByRole("heading", { name: "Recent executions" }),
    })
    await expect(recent.getByRole("link", { name: broken })).toBeVisible()
    await expect(recent.getByText("Enqueue failed").first()).toBeVisible()

    const nextRuns = app.locator("[data-slot=card]").filter({
      has: app.getByRole("heading", { name: "Next runs" }),
    })
    await expect(nextRuns.getByRole("link", { name: due })).toBeVisible()

    const local = app.locator("[data-slot=card]").filter({
      has: app.getByRole("heading", { name: "local" }),
    })
    await expect(local.getByText("Reachable", { exact: true })).toBeVisible()
    await expect(local.getByText(/^Schedules \d+/)).toBeVisible()
    await expectNoSeriousAxeViolations(app)

    await recent.getByRole("link", { name: broken }).click()
    await expect(app.getByRole("heading", { name: "Execution details" })).toBeVisible()
  })

  test("leads from a summary card to its screen", async ({ app }) => {
    await app.goto("/")
    // The sidebar also links to Schedules; only the card's name carries its count.
    await app.getByRole("link", { name: /^Schedules\s*\d+ of \d+ enabled/ }).click()
    await expect(app.getByRole("heading", { name: "Schedules" })).toBeVisible()
  })
})
