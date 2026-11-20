// Requires a running conductor with gRPC-Web enabled: bash scripts/test-env.sh up
import { afterEach, describe, expect, it } from "vitest"
import { createConductorClients } from "@/lib/clients"
import { findEntity } from "@/lib/entities"
import { classifyError } from "@/lib/errors"
import { EXECUTION_TARGET_DEFAULTS } from "@/lib/execution-target/form"
import { nowSeconds } from "@/lib/format"
import { ReactionOperation as Op } from "@/lib/grpc/jobworkerp_conductor/data/slack_event_handler"
import {
  SLACK_HANDLER_FORM_DEFAULTS,
  eventKindOf,
  toSlackHandlerData,
  type SlackHandlerFormValues,
} from "@/lib/slack/form"
import { TEST_CONDUCTOR_URL } from "@/test/endpoints"
import { uniqueName } from "@/test/names"
import { localServerId } from "@/test/servers"
import { createConfig, deleteConfig, listConfig, setConfigEnabled, updateConfig } from "./config"

const conductor = createConductorClients(TEST_CONDUCTOR_URL)
const created: string[] = []
afterEach(async () => {
  for (const id of created.splice(0))
    await deleteConfig(conductor, "slackHandlers", id).catch(() => {})
})

async function values(
  overrides: Partial<SlackHandlerFormValues> = {},
): Promise<SlackHandlerFormValues> {
  const serverId = await localServerId(conductor)
  return {
    ...SLACK_HANDLER_FORM_DEFAULTS,
    name: uniqueName("it-slack", "h"),
    messagePattern: "(?i)deploy",
    target: {
      ...EXECUTION_TARGET_DEFAULTS,
      serverId,
      method: "worker",
      workerName: "w",
      args: "{}",
    },
    ...overrides,
  }
}

async function create(form: SlackHandlerFormValues) {
  const id = await createConfig(conductor, "slackHandlers", toSlackHandlerData(form, nowSeconds()))
  created.push(id)
  return id
}

const stored = async (id: string) =>
  findEntity(await listConfig(conductor, "slackHandlers"), id)?.data

describe("Slack event handlers", () => {
  it("creates, updates, toggles and deletes a handler, keeping its kind", async () => {
    const form = await values()
    const id = await create(form)
    expect(eventKindOf((await stored(id))!)).toBe("message")

    await updateConfig(
      conductor,
      "slackHandlers",
      id,
      toSlackHandlerData(
        {
          ...form,
          kind: "reaction",
          reactionNames: ["eyes"],
          reactionOperation: Op.REACTION_OPERATION_REMOVED,
        },
        nowSeconds(),
      ),
    )
    const updated = (await stored(id))!
    expect(eventKindOf(updated)).toBe("reaction")
    expect(updated).toMatchObject({
      messagePattern: undefined,
      reactionNames: "eyes",
      reactionOperation: Op.REACTION_OPERATION_REMOVED,
    })

    await setConfigEnabled(conductor, "slackHandlers", id, false, nowSeconds())
    expect((await stored(id))?.enabled).toBe(false)

    await deleteConfig(conductor, "slackHandlers", id)
    expect(await stored(id)).toBeUndefined()
  })

  it("creates a handler enabled even when asked for a disabled one (conductor #80)", async () => {
    const id = await create(await values({ enabled: false }))
    expect((await stored(id))?.enabled).toBe(true)
  })

  it("refuses a pattern conductor's regex cannot compile, with its message", async () => {
    const error = await create(await values({ messagePattern: "a(?=b)" })).catch((e: unknown) => e)
    const classified = classifyError(error)
    expect(classified.kind).toBe("status")
    expect(classified.serverMessage).toMatch(/regex/i)
  })
})
