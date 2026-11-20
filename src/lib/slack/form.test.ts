import { beforeAll, describe, expect, it } from "vitest"
import { EXECUTION_TARGET_DEFAULTS } from "@/lib/execution-target/form"
import type { ExecutionTargetContext } from "@/lib/execution-target/validate"
import { ReactionOperation as Op } from "@/lib/grpc/jobworkerp_conductor/data/slack_event_handler"
import {
  PATTERN_MAX_BYTES,
  REACTION_NAMES_MAX,
  SLACK_HANDLER_FORM_DEFAULTS,
  SLACK_TIMEOUT_SEC,
  addReactionNames,
  eventKindOf,
  isValidChannelId,
  toSlackHandlerData,
  toSlackHandlerForm,
  validateSlackHandlerForm,
  type SlackHandlerFormValues,
} from "./form"
import { loadTestRustRegex } from "@/test/wasm"
import type { RustRegex } from "./rust-regex"

let regex: RustRegex
beforeAll(async () => {
  regex = await loadTestRustRegex()
})

const context: ExecutionTargetContext = {
  kind: "slackHandler",
  workflowRunner: false,
  inlineAvailable: true,
}

const message: SlackHandlerFormValues = {
  ...SLACK_HANDLER_FORM_DEFAULTS,
  name: "summarize",
  messagePattern: "(?i)summarize",
  target: {
    ...EXECUTION_TARGET_DEFAULTS,
    serverId: "1",
    method: "worker",
    workerName: "w",
    args: "{}",
  },
}
const reaction: SlackHandlerFormValues = {
  ...message,
  kind: "reaction",
  reactionNames: ["eyes", "+1"],
  reactionOperation: Op.REACTION_OPERATION_BOTH,
  reactionUserFilter: "^U",
}

describe("SLACK_HANDLER_FORM_DEFAULTS", () => {
  it("starts as a message handler, reacting to added reactions when switched", () => {
    expect(SLACK_HANDLER_FORM_DEFAULTS).toMatchObject({
      kind: "message",
      reactionOperation: Op.REACTION_OPERATION_ADDED,
      enabled: true,
    })
  })
})

describe("toSlackHandlerData", () => {
  it("stores only the message conditions for a message handler", () => {
    const data = toSlackHandlerData({ ...reaction, kind: "message", mentionRequired: true }, 1)
    expect(data).toMatchObject({
      messagePattern: "(?i)summarize",
      mentionRequired: true,
      reactionNames: undefined,
      reactionOperation: Op.REACTION_OPERATION_UNSPECIFIED,
      reactionUserFilter: undefined,
    })
  })

  it("stores only the reaction conditions for a reaction handler", () => {
    const data = toSlackHandlerData({ ...reaction, mentionRequired: true }, 1)
    expect(data).toMatchObject({
      messagePattern: undefined,
      mentionRequired: false,
      reactionNames: "eyes,+1",
      reactionOperation: Op.REACTION_OPERATION_BOTH,
      reactionUserFilter: "^U",
    })
  })

  it("sends the fixed timeout, the target in the new format and both timestamps", () => {
    expect(
      toSlackHandlerData({ ...message, channelId: " C0123ABC " }, 1_700_000_000),
    ).toMatchObject({
      slackChannelId: "C0123ABC",
      jobworkerpServerId: { value: "1" },
      timeoutSec: SLACK_TIMEOUT_SEC,
      workflowUrl: "",
      channel: "",
      worker: { workerName: "w", using: undefined },
      args: "{}",
      createdAt: "1700000000",
      updatedAt: "1700000000",
    })
    expect(SLACK_TIMEOUT_SEC).toBe(3600)
  })

  it("leaves empty optional conditions unset", () => {
    expect(
      toSlackHandlerData(
        { ...reaction, reactionNames: [], reactionUserFilter: "", channelId: "" },
        1,
      ),
    ).toMatchObject({
      reactionNames: undefined,
      reactionUserFilter: undefined,
      slackChannelId: undefined,
    })
  })
})

describe("eventKindOf / toSlackHandlerForm", () => {
  it("tells the kind from the stored conditions", () => {
    expect(eventKindOf(toSlackHandlerData(message, 1))).toBe("message")
    expect(eventKindOf(toSlackHandlerData(reaction, 1))).toBe("reaction")
    expect(
      eventKindOf(
        toSlackHandlerData({ ...reaction, reactionNames: [], reactionUserFilter: "" }, 1),
      ),
    ).toBe("reaction")
  })

  it("round-trips both kinds through the form", () => {
    expect(toSlackHandlerForm(toSlackHandlerData(message, 1))).toEqual(message)
    expect(toSlackHandlerForm(toSlackHandlerData(reaction, 1))).toEqual({
      ...reaction,
      messagePattern: "",
    })
  })
})

describe("addReactionNames", () => {
  it("strips colons and spaces, splits on commas and spaces, and drops duplicates", () => {
    expect(addReactionNames(["eyes"], ":eyes:, :+1: white_check_mark ")).toEqual([
      "eyes",
      "+1",
      "white_check_mark",
    ])
    expect(addReactionNames([], " , :: ")).toEqual([])
  })
})

describe("isValidChannelId", () => {
  it.each(["C0123ABCD", "G01ABCDEF"])("accepts %s", (id) => expect(isValidChannelId(id)).toBe(true))
  it.each(["D0123ABCD", "c0123abcd", "#general", "C"])("rejects %s", (id) =>
    expect(isValidChannelId(id)).toBe(false),
  )
})

describe("validateSlackHandlerForm", () => {
  const validate = (values: SlackHandlerFormValues) =>
    validateSlackHandlerForm(values, context, regex)

  it("accepts valid handlers of both kinds", () => {
    expect(validate(message)).toEqual({})
    expect(validate(reaction)).toEqual({})
    expect(validate({ ...message, messagePattern: "", mentionRequired: true })).toEqual({})
  })

  it("needs a pattern or a required mention for a message handler", () => {
    expect(
      validate({ ...message, messagePattern: "", mentionRequired: false }).messagePattern,
    ).toEqual({
      key: "slackHandlers.form.errors.needCondition",
    })
  })

  it("checks patterns with conductor's rules and its byte limit", () => {
    expect(validate({ ...message, messagePattern: "a(?=b)" }).messagePattern?.key).toBe(
      "slackHandlers.form.errors.regex",
    )
    expect(validate({ ...message, messagePattern: "(?x) a" }).messagePattern).toBeUndefined()
    expect(
      validate({ ...message, messagePattern: "a".repeat(PATTERN_MAX_BYTES) }).messagePattern,
    ).toBeUndefined()
    // 167 "あ" are 501 bytes, as conductor counts.
    expect(validate({ ...message, messagePattern: "あ".repeat(167) }).messagePattern).toEqual({
      key: "slackHandlers.form.errors.patternTooLong",
      values: { max: PATTERN_MAX_BYTES },
    })
    expect(validate({ ...reaction, reactionUserFilter: "(" }).reactionUserFilter?.key).toBe(
      "slackHandlers.form.errors.regex",
    )
  })

  it("leaves the syntax to the server when the regex module is unavailable", () => {
    expect(
      validateSlackHandlerForm({ ...message, messagePattern: "a(?=b)" }, context, undefined),
    ).toEqual({})
  })

  it("limits reaction names", () => {
    const names = (n: number) => Array.from({ length: n }, (_, i) => `r${i}`)
    expect(
      validate({ ...reaction, reactionNames: names(REACTION_NAMES_MAX) }).reactionNames,
    ).toBeUndefined()
    expect(
      validate({ ...reaction, reactionNames: names(REACTION_NAMES_MAX + 1) }).reactionNames,
    ).toEqual({
      key: "slackHandlers.form.errors.tooManyReactions",
      values: { max: REACTION_NAMES_MAX },
    })
    expect(
      validate({ ...reaction, reactionNames: ["a".repeat(100)] }).reactionNames,
    ).toBeUndefined()
    expect(validate({ ...reaction, reactionNames: ["a".repeat(101)] }).reactionNames?.key).toBe(
      "slackHandlers.form.errors.invalidReaction",
    )
    expect(validate({ ...reaction, reactionNames: ["thumbs up"] }).reactionNames).toEqual({
      key: "slackHandlers.form.errors.invalidReaction",
      values: { name: "thumbs up" },
    })
    // conductor allows letters of any script, as Rust's is_alphanumeric does.
    expect(validate({ ...reaction, reactionNames: ["了解"] }).reactionNames).toBeUndefined()
  })

  it("checks the channel ID format", () => {
    expect(validate({ ...message, channelId: "#general" }).channelId?.key).toBe(
      "slackHandlers.form.errors.channelId",
    )
  })

  it("checks the arguments with Slack's rules through the target", () => {
    expect(
      validate({ ...message, target: { ...message.target, args: "[1]" } }).target?.args?.key,
    ).toBe("executionTarget.args.errors.slackObject")
  })
})
