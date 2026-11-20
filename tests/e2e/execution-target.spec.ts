import { WORKFLOW_TEMPLATE } from "../../src/lib/execution-target/definition"
import {
  deleteManagedWorkflow,
  saveManagedWorkflow,
} from "../../src/lib/services/managed-workflows"
import {
  cleanUpByPrefix,
  createServerViaApi,
  expect,
  expectNoSeriousAxeViolations,
  jobworkerp,
  test,
  uniqueName,
} from "./fixtures"

// The field is shared by the setting screens; the result handler screen hosts it here.
const PAGE = "/result-handlers/new"

test.describe("execution target field", () => {
  let prefix: string
  test.beforeEach(() => {
    prefix = uniqueName("target")
  })
  test.afterEach(async () => {
    await cleanUpByPrefix(prefix)
  })

  async function openWithLocal(app: import("@playwright/test").Page) {
    await app.goto(PAGE)
    await app.getByLabel(/^Name/).fill("daily report")
    await app.getByLabel(/^Server/).selectOption({ label: "local" })
  }

  test("suggests the server's workers and describes the chosen one", async ({ app }) => {
    await openWithLocal(app)
    const name = app.getByLabel(/^Worker name/)
    await name.fill("conductor_cron-scheduler_")
    const listId = await name.getAttribute("list")
    await expect(app.locator(`datalist[id="${listId}"] option`).first()).toHaveAttribute(
      "value",
      /^conductor_cron-scheduler_/,
    )
    await name.fill("conductor_cron-scheduler_create")
    await expect(app.getByText(/^Runner: /)).toBeVisible()
    await expect(app.getByRole("link", { name: "Open in admin-ui" })).toHaveAttribute(
      "href",
      /^http:\/\/127\.0\.0\.1:5174\/workers\/\d+$/,
    )
    await name.fill(`${prefix}-no-such-worker`)
    await expect(app.getByText("No worker with this name exists on the server.")).toBeVisible()
  })

  test("offers the methods of a WORKFLOW worker", async ({ app }) => {
    const workerName = `${prefix}-wf`
    await saveManagedWorkflow(jobworkerp, {
      name: workerName,
      kind: "schedule",
      settingName: workerName,
      definition: WORKFLOW_TEMPLATE,
      channel: "",
    })
    try {
      await openWithLocal(app)
      await app.getByLabel(/^Worker name/).fill(workerName)
      await expect(app.getByLabel(/^Method \(using\)/)).toHaveAccessibleDescription(
        /Methods: create, run/,
      )
      // Result handlers nest the arguments under "args", so the WORKFLOW
      // runner's own argument names do not clash here.
      await app.getByLabel(/^Arguments/).fill('{"input":"x"}')
      await expect(app.getByLabel(/^Arguments/)).toHaveAccessibleDescription("JSON, up to 64 KB")
    } finally {
      await deleteManagedWorkflow(jobworkerp, workerName)
    }
  })

  test("writes an inline definition with a default worker name and checks its syntax", async ({
    app,
  }) => {
    await openWithLocal(app)
    await app.getByRole("radio", { name: /Workflow \(written here\)/ }).check()
    await expect(app.getByLabel(/^Stored as worker/)).toHaveValue(
      /^conductor-result-daily-report-[0-9a-z]+$/,
    )
    const editor = app.getByRole("textbox", { name: /^Workflow definition/ })
    await app.getByRole("button", { name: "Insert template" }).click()
    await expect(editor).toContainText('dsl: "1.0.0"')
    await expect(app.getByRole("button", { name: "Insert template" })).toBeDisabled()

    // fill() replaces the text as one input, bypassing auto-indent on Enter.
    await editor.fill("x:\n  y: 1\n z: 2")
    await expect(editor).toHaveText("x:  y: 1 z: 2")
    await app.getByRole("button", { name: "Save" }).click()
    await expect(app.getByText(/Syntax error at line 3, column 1/)).toBeVisible()

    const channel = app.getByLabel(/^Channel/)
    const listId = await channel.getAttribute("list")
    await expect(app.locator(`datalist[id="${listId}"] option[value="batch"]`)).toHaveCount(1)
  })

  test("refuses an inline definition on a server without a jobworkerp link", async ({ app }) => {
    const name = `${prefix}-unlinked`
    await createServerViaApi(name)
    await app.goto(PAGE)
    await app.getByLabel(/^Server/).selectOption({ label: name })
    const inline = app.getByRole("radio", { name: /Workflow \(written here\)/ })
    await expect(inline).toBeDisabled()
    await expect(inline).toHaveAccessibleDescription(/runtime configuration/)
  })

  test("has no serious axe violations with the code editor open", async ({ app }) => {
    await openWithLocal(app)
    await app.getByRole("radio", { name: /Workflow \(written here\)/ }).check()
    await app.getByRole("button", { name: "Insert template" }).click()
    await expectNoSeriousAxeViolations(app)
  })
})
