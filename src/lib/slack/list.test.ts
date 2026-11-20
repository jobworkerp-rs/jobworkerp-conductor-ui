import { describe, expect, it } from "vitest"
import { ReactionOperation as Op } from "@/lib/grpc/jobworkerp_conductor/data/slack_event_handler"
import type { ConfigEntity } from "@/lib/services/config"
import { channelsOf, filterSlackHandlers, parseSlackFilter, summarizeSlackHandlers } from "./list"

function handler(
  id: string,
  name: string,
  overrides: Partial<ConfigEntity<"slackHandlers">["data"]> = {},
): ConfigEntity<"slackHandlers"> {
  return {
    id,
    data: {
      name,
      enabled: true,
      mentionRequired: false,
      reactionOperation: Op.REACTION_OPERATION_UNSPECIFIED,
      messagePattern: "x",
      ...overrides,
    } as ConfigEntity<"slackHandlers">["data"],
  }
}

const handlers = [
  handler("1", "deploy-notice", { slackChannelId: "C1" }),
  handler("2", "summarize", { slackChannelId: "C2", enabled: false }),
  handler("3", "ack", {
    messagePattern: undefined,
    reactionOperation: Op.REACTION_OPERATION_ADDED,
    slackChannelId: "C1",
  }),
  handler("4", "anywhere"),
]

describe("summarizeSlackHandlers", () => {
  it("counts kinds, enabled handlers and distinct watched channels", () => {
    expect(summarizeSlackHandlers(handlers)).toEqual({
      total: 4,
      messages: 3,
      reactions: 1,
      enabled: 3,
      channels: 2,
    })
  })
})

describe("filterSlackHandlers", () => {
  const ids = (filter: Parameters<typeof filterSlackHandlers>[1]) =>
    filterSlackHandlers(handlers, filter).map((h) => h.id)

  it("filters by name (case-insensitively), kind, status and channel together", () => {
    expect(ids({})).toEqual(["1", "2", "3", "4"])
    expect(ids({ q: "SUMM" })).toEqual(["2"])
    expect(ids({ kind: "reaction" })).toEqual(["3"])
    expect(ids({ status: "disabled" })).toEqual(["2"])
    expect(ids({ channel: "C1", kind: "message" })).toEqual(["1"])
  })
})

describe("parseSlackFilter", () => {
  it("reads known values from the URL and ignores the rest", () => {
    expect(
      parseSlackFilter(new URLSearchParams("q=dep&kind=reaction&status=enabled&channel=C1&page=2")),
    ).toEqual({ q: "dep", kind: "reaction", status: "enabled", channel: "C1" })
    expect(parseSlackFilter(new URLSearchParams("kind=other&status=x"))).toEqual({})
  })
})

describe("channelsOf", () => {
  it("lists named channels once, sorted", () => {
    expect(channelsOf(handlers)).toEqual(["C1", "C2"])
  })
})
