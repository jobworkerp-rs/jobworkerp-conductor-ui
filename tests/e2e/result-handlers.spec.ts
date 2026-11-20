import { WORKFLOW_TEMPLATE } from "../../src/lib/execution-target/definition"
import { findWorkerByName, searchWorkers } from "../../src/lib/services/jobworkerp"
import { saveManagedWorkflow } from "../../src/lib/services/managed-workflows"
import {
  cleanUpByPrefix,
  expect,
  expectNoSeriousAxeViolations,
  jobworkerp,
  test,
  uniqueName,
} from "./fixtures"

const LIST = "/result-handlers"

test.describe("result handlers", () => {
  let prefix: string
  test.beforeEach(() => {
    prefix = uniqueName("rh")
  })
  test.afterEach(async () => {
    await cleanUpByPrefix(prefix)
  })

  async function startCreating(
    app: import("@playwright/test").Page,
    name: string,
    watched: string,
  ) {
    await app.goto(LIST)
    await app.getByRole("link", { name: "Create" }).click()
    await expect(app.getByRole("heading", { name: "Create result handler" })).toBeVisible()
    await app.getByLabel(/^Name/).fill(name)
    await app.getByLabel(/^Watched server/).selectOption({ label: "local" })
    await app.getByLabel(/^Watched worker/).fill(watched)
  }

  async function watchedWorker(label: string) {
    const name = `${prefix}-${label}`
    await saveManagedWorkflow(jobworkerp, {
      name,
      kind: "resultHandler",
      settingName: name,
      definition: WORKFLOW_TEMPLATE,
      channel: "",
    })
    return name
  }

  test("creates a handler that runs a registered worker on the watched server", async ({ app }) => {
    const name = `${prefix}-worker`
    const watched = await watchedWorker("watched")
    await startCreating(app, name, watched)
    // The follow-up runs where the watched worker lives unless chosen otherwise.
    await expect(app.getByLabel(/^Server/)).toHaveValue(
      await app.getByLabel(/^Watched server/).inputValue(),
    )
    await app.getByLabel(/^Worker name/).fill(watched)
    await app.getByLabel(/^Arguments/).fill('{"tag":"x"}')
    await app.getByRole("button", { name: "Save" }).click()

    await expect(app.getByRole("heading", { name: "Result Handlers" })).toBeVisible()
    const row = app.getByRole("row").filter({ hasText: name })
    await expect(row).toContainText(`local / ${watched}`)
    await expect(row).toContainText(`Worker: ${watched}`)
    await expect(row.getByRole("link", { name: `Executions of ${name}` })).toHaveAttribute(
      "href",
      /\/executions\?sourceType=resultHandler&sourceId=\d+/,
    )
  })

  test("warns when the watched worker does not broadcast its results", async ({ app }) => {
    const broadcasting = await watchedWorker("broadcasting")
    await startCreating(app, `${prefix}-warn`, broadcasting)
    const field = app.getByLabel(/^Watched worker/)
    await expect(field).toHaveAccessibleDescription(/Pick from the server's workers/)
    await expect(field).not.toHaveAccessibleDescription(/does not broadcast/)

    // conductor's own bootstrap workers do not broadcast their results.
    const silent = (await searchWorkers(jobworkerp, "conductor_")).find(
      (w) => !w.data?.broadcastResults,
    )!.data!.name
    await field.fill(silent)
    await expect(field).toHaveAccessibleDescription(/does not broadcast its results/)
  })

  test("stores an inline definition, reads it back, and removes the worker when switching away", async ({
    app,
  }) => {
    const name = `${prefix}-inline`
    const watched = await watchedWorker("watched")
    await startCreating(app, name, watched)
    await app.getByRole("radio", { name: /Workflow \(written here\)/ }).check()
    const workerName = await app.getByLabel(/^Stored as worker/).inputValue()
    expect(workerName).toBe(`conductor-result-${name}`)
    await app.getByRole("button", { name: "Insert template" }).click()
    await app.getByRole("button", { name: "Save" }).click()
    const row = app.getByRole("row").filter({ hasText: name })
    await expect(row).toContainText(`Workflow written here (worker ${workerName})`)
    expect(await findWorkerByName(jobworkerp, workerName)).toBeDefined()

    await row.getByRole("link", { name: `Edit ${name}` }).click()
    await expect(app.getByRole("radio", { name: /Workflow \(written here\)/ })).toBeChecked()
    await expect(app.getByRole("textbox", { name: /^Workflow definition/ })).toContainText(
      'dsl: "1.0.0"',
    )
    await app.getByRole("radio", { name: /Registered worker/ }).check()
    await app.getByLabel(/^Worker name/).fill(watched)
    const cleanup = app.getByRole("checkbox", {
      name: new RegExp(`Delete the worker ${workerName}`),
    })
    await expect(cleanup).toBeChecked()
    await app.getByRole("button", { name: "Save" }).click()
    await expect(row).toContainText(`Worker: ${watched}`)
    await expect.poll(() => findWorkerByName(jobworkerp, workerName)).toBeUndefined()
  })

  test("deletes a handler together with the worker storing its definition", async ({ app }) => {
    const name = `${prefix}-delete`
    const watched = await watchedWorker("watched")
    await startCreating(app, name, watched)
    await app.getByRole("radio", { name: /Workflow \(written here\)/ }).check()
    const workerName = await app.getByLabel(/^Stored as worker/).inputValue()
    await app.getByRole("button", { name: "Insert template" }).click()
    await app.getByRole("button", { name: "Save" }).click()
    const row = app.getByRole("row").filter({ hasText: name })
    await expect(row).toBeVisible()

    await row.getByRole("button", { name: `Delete ${name}` }).click()
    const dialog = app.getByRole("alertdialog", { name: `Delete ${name}?` })
    await expect(dialog.getByRole("checkbox", { name: new RegExp(workerName) })).toBeChecked()
    await dialog.getByRole("button", { name: "Delete" }).click()
    await expect(app.getByRole("row").filter({ hasText: name })).toHaveCount(0)
    await expect.poll(() => findWorkerByName(jobworkerp, workerName)).toBeUndefined()
  })

  test("toggles a handler from the list", async ({ app }) => {
    const name = `${prefix}-toggle`
    const watched = await watchedWorker("watched")
    await startCreating(app, name, watched)
    await app.getByLabel(/^Worker name/).fill(watched)
    await app.getByRole("button", { name: "Save" }).click()
    const toggle = app.getByRole("switch", { name: `Enable or disable ${name}` })
    await expect(toggle).toBeChecked()
    await toggle.click()
    await expect(toggle).not.toBeChecked()
  })

  test("refuses to save without the required fields and focuses the first", async ({ app }) => {
    await app.goto(`${LIST}/new`)
    await app.getByRole("button", { name: "Save" }).click()
    await expect(app.getByLabel(/^Name/)).toBeFocused()
    await expect(app.getByLabel(/^Watched worker/)).toHaveAttribute("aria-invalid", "true")
  })

  for (const path of [LIST, `${LIST}/new`]) {
    test(`has no serious axe violations on ${path}`, async ({ app }) => {
      await app.goto(path)
      await expect(app.getByText("Connected to the conductor API")).toBeVisible()
      await expect(app.getByText("Loading…")).toHaveCount(0)
      await expectNoSeriousAxeViolations(app)
    })
  }
})
