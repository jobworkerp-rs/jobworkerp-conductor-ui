import { describe, expect, it } from "vitest"
import { ARGS_MAX_BYTES, argsError, formatArgs, validateArgs, type ArgsContext } from "./args"

const schedule: ArgsContext = { kind: "schedule", method: "workflowUrl", workflowRunner: false }

describe("validateArgs", () => {
  it("accepts empty args and JSON values", () => {
    expect(validateArgs("", schedule)).toEqual({ warnings: [] })
    expect(validateArgs("  ", schedule)).toEqual({ warnings: [] })
    expect(validateArgs('{"a":[1,2]}', schedule)).toEqual({ warnings: [] })
    expect(validateArgs("[1]", schedule)).toEqual({ warnings: [] })
  })

  it("rejects invalid JSON with the parser's message", () => {
    const result = validateArgs('{"a":', schedule)
    expect(result.error?.key).toBe("executionTarget.args.errors.invalidJson")
    expect(result.error?.detail).toBeTruthy()
  })

  it("limits the size to 64KB of UTF-8, counting multi-byte characters", () => {
    const wrap = (filler: string) => `"${filler}"`
    const ascii = "a".repeat(ARGS_MAX_BYTES - 2)
    expect(validateArgs(wrap(ascii), schedule).error).toBeUndefined()
    expect(validateArgs(wrap(`${ascii}a`), schedule).error?.key).toBe(
      "executionTarget.args.errors.tooLarge",
    )
    // "あ" is 3 bytes: 21844 * 3 + 2 quotes = 65534 bytes; one more crosses the limit.
    expect(validateArgs(wrap("あ".repeat(21844)), schedule).error).toBeUndefined()
    expect(validateArgs(wrap(`${"あ".repeat(21844)}あ`), schedule).error?.key).toBe(
      "executionTarget.args.errors.tooLarge",
    )
  })

  describe("Slack events", () => {
    const slack: ArgsContext = { kind: "slackHandler", method: "worker", workflowRunner: false }
    it("requires an object", () => {
      expect(validateArgs("[1]", slack).error?.key).toBe("executionTarget.args.errors.slackObject")
      expect(validateArgs('"x"', slack).error?.key).toBe("executionTarget.args.errors.slackObject")
      expect(validateArgs("{}", slack).error).toBeUndefined()
    })
    it("forbids a top-level slack_event", () => {
      expect(validateArgs('{"slack_event":1}', slack).error?.key).toBe(
        "executionTarget.args.errors.slackEvent",
      )
      expect(validateArgs('{"x":{"slack_event":1}}', slack).error).toBeUndefined()
    })
  })

  describe("names of the WORKFLOW runner's own arguments", () => {
    const inline: ArgsContext = { kind: "schedule", method: "workflowInline", workflowRunner: true }

    it.each([
      ["input", '"x"'],
      ["workflow_url", '"x"'],
      ["workflowUrl", '"x"'],
      ["workflow_data", '"x"'],
      ["workflowData", '"x"'],
      ["workflow_context", '"x"'],
      ["workflowContext", '"x"'],
      ["execution_id", '"x"'],
      ["executionId", '"x"'],
      ["workflow_source", "{}"],
      ["workflowSource", "{}"],
      ["from_checkpoint", "{}"],
      ["fromCheckpoint", "{}"],
    ])("warns about %s", (name, value) => {
      expect(validateArgs(`{"${name}":${value}}`, inline).warnings).toEqual([name])
    })

    it("ignores the names when the value has another type or sits deeper", () => {
      expect(validateArgs('{"input":{"a":1},"workflow_source":"s"}', inline).warnings).toEqual([])
      expect(validateArgs('{"nested":{"input":"x"}}', inline).warnings).toEqual([])
    })

    it("applies to schedules and Slack events running a workflow through a worker", () => {
      const args = '{"input":"x"}'
      const cases: [ArgsContext, string[]][] = [
        [{ kind: "schedule", method: "workflowInline", workflowRunner: true }, ["input"]],
        [{ kind: "schedule", method: "worker", workflowRunner: true }, ["input"]],
        [{ kind: "slackHandler", method: "worker", workflowRunner: true }, ["input"]],
        [{ kind: "schedule", method: "worker", workflowRunner: false }, []],
        [{ kind: "schedule", method: "workflowUrl", workflowRunner: false }, []],
        // Result handlers nest the args under "args".
        [{ kind: "resultHandler", method: "workflowInline", workflowRunner: true }, []],
      ]
      for (const [context, expected] of cases) {
        expect(validateArgs(args, context).warnings).toEqual(expected)
      }
    })
  })
})

describe("formatArgs", () => {
  it("pretty-prints valid JSON and leaves invalid text alone", () => {
    expect(formatArgs('{"a":1,"b":[1,2]}')).toBe('{\n  "a": 1,\n  "b": [\n    1,\n    2\n  ]\n}')
    expect(formatArgs("{oops")).toBe("{oops")
    expect(formatArgs("")).toBe("")
  })
})

describe("argsError", () => {
  it("reports what blocks saving, whatever the target", () => {
    expect(argsError("", "schedule")).toBeUndefined()
    expect(argsError('{"input":"x"}', "schedule")).toBeUndefined()
    expect(argsError("{bad", "schedule")?.key).toBe("executionTarget.args.errors.invalidJson")
    expect(argsError("[1]", "slackHandler")?.key).toBe("executionTarget.args.errors.slackObject")
  })
})
