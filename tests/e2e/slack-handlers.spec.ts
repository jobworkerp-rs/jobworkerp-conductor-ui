import { findEntity } from "../../src/lib/entities"
import { EXECUTION_TARGET_DEFAULTS } from "../../src/lib/execution-target/form"
import { nowSeconds } from "../../src/lib/format"
import { ReactionOperation as Op } from "../../src/lib/grpc/jobworkerp_conductor/data/slack_event_handler"
import { createConfig, listConfig } from "../../src/lib/services/config"
import { SLACK_HANDLER_FORM_DEFAULTS, toSlackHandlerData } from "../../src/lib/slack/form"
import { localServerId } from "../../src/test/servers"
import {
  cleanUpByPrefix,
  conductor,
  expect,
  expectNoSeriousAxeViolations,
  test,
  uniqueName,
} from "./fixtures"

const LIST = "/slack-handlers"

test.describe("Slack event handlers", () => {
  let prefix: string
  test.beforeEach(() => {
    prefix = uniqueName("slack")
  })
  test.afterEach(async () => {
    await cleanUpByPrefix(prefix)
  })

  async function startCreating(app: import("@playwright/test").Page, name: string) {
    await app.goto(LIST)
    await app.getByRole("link", { name: "Create" }).click()
    await expect(app.getByRole("heading", { name: "Create Slack event handler" })).toBeVisible()
    await app.getByLabel(/^Name/).fill(name)
    await app.getByLabel(/^Server/).selectOption({ label: "local" })
    await app.getByLabel(/^Worker name/).fill("conductor_cron-scheduler_find-list")
  }

  test("creates a message handler, tries its pattern, then switches it to reactions", async ({
    app,
  }) => {
    const name = `${prefix}-switch`
    await startCreating(app, name)
    await expect(app.getByText("A new handler is always created enabled")).toBeVisible()
    await app.getByLabel(/^Message pattern/).fill("(?i)^deploy")
    // The sample is tried with conductor's (Rust) rules, loaded as WebAssembly.
    await app.getByLabel("Try a text").fill("Deploy to prod")
    await expect(app.getByRole("status").filter({ hasText: /match/i })).toHaveText("Matches")
    await app.getByRole("button", { name: "Save" }).click()

    const row = app.getByRole("row").filter({ hasText: name })
    await expect(row).toContainText("Message")
    await expect(row).toContainText("Text matches (?i)^deploy")

    await row.getByRole("link", { name: `Edit ${name}` }).click()
    await app.getByRole("radio", { name: "Reaction" }).check()
    const reactions = app.getByLabel(/^Reactions/)
    await reactions.fill(":eyes:")
    await reactions.press("Enter")
    await reactions.pressSequentially("+1,")
    await app.getByLabel(/^Reaction event/).selectOption({ label: "Added or removed" })
    await app.getByRole("button", { name: "Save" }).click()

    await expect(row).toContainText("Reaction")
    await expect(row).toContainText("Reactions eyes, +1 (added or removed)")
    const stored = (await listConfig(conductor, "slackHandlers")).find((h) => h.data.name === name)!
    expect(stored.data).toMatchObject({
      messagePattern: undefined,
      reactionNames: "eyes,+1",
      reactionOperation: Op.REACTION_OPERATION_BOTH,
    })
  })

  test("refuses a pattern conductor's regex cannot compile, before sending it", async ({ app }) => {
    await startCreating(app, `${prefix}-lookahead`)
    // Valid in JavaScript, but Rust's regex has no look-ahead.
    await app.getByLabel(/^Message pattern/).fill("deploy(?=now)")
    await app.getByRole("button", { name: "Save" }).click()
    const pattern = app.getByLabel(/^Message pattern/)
    await expect(pattern).toHaveAttribute("aria-invalid", "true")
    await expect(pattern).toHaveAccessibleDescription(/conductor cannot use this pattern/)
    await expect(app.getByRole("heading", { name: "Create Slack event handler" })).toBeVisible()
  })

  test("needs a pattern or a required mention for a message handler", async ({ app }) => {
    await startCreating(app, `${prefix}-nothing`)
    await app.getByRole("button", { name: "Save" }).click()
    await expect(app.getByLabel(/^Message pattern/)).toHaveAccessibleDescription(
      /only when mentioned/,
    )
  })

  test("warns about the WORKFLOW runner's own argument names for an inline workflow", async ({
    app,
  }) => {
    await startCreating(app, `${prefix}-reserved`)
    await app.getByRole("radio", { name: /Workflow \(written here\)/ }).check()
    await app.getByLabel(/^Arguments/).fill('{"input":"x"}')
    await expect(app.getByLabel(/^Arguments/)).toHaveAccessibleDescription(
      /input is also an argument of the WORKFLOW runner/,
    )
  })

  test("summarizes and filters the list, keeping the filter in the URL", async ({ app }) => {
    const serverId = await localServerId(conductor)
    const base = {
      ...SLACK_HANDLER_FORM_DEFAULTS,
      target: {
        ...EXECUTION_TARGET_DEFAULTS,
        serverId,
        method: "worker" as const,
        workerName: "w",
      },
    }
    await createConfig(
      conductor,
      "slackHandlers",
      toSlackHandlerData(
        { ...base, name: `${prefix}-m`, messagePattern: "x", channelId: "C0E2E" },
        nowSeconds(),
      ),
    )
    const reactionId = await createConfig(
      conductor,
      "slackHandlers",
      toSlackHandlerData(
        { ...base, name: `${prefix}-r`, kind: "reaction", reactionNames: ["eyes"] },
        nowSeconds(),
      ),
    )
    await app.goto(`${LIST}?q=${prefix}`)
    await expect(app.getByRole("row").filter({ hasText: prefix })).toHaveCount(2)
    await expect(app.getByText(/messages?|reaction/).first()).toBeVisible()

    await app.getByLabel("Kind").selectOption({ label: "Reaction" })
    await expect(app).toHaveURL(/kind=reaction/)
    const rows = app.getByRole("row").filter({ hasText: prefix })
    await expect(rows).toHaveCount(1)
    await expect(rows).toContainText(`${prefix}-r`)
    expect(findEntity(await listConfig(conductor, "slackHandlers"), reactionId)).toBeDefined()

    await app.reload()
    await expect(app.getByLabel("Kind")).toHaveValue("reaction")
    await expect(app.getByRole("row").filter({ hasText: prefix })).toHaveCount(1)
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
