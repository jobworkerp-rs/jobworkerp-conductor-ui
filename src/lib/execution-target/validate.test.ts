import { describe, expect, it } from "vitest"
import { EXECUTION_TARGET_DEFAULTS, type ExecutionTargetForm } from "./form"
import { SLACK_WORKFLOW_URL_MAX, validateExecutionTarget } from "./validate"

const worker: ExecutionTargetForm = {
  ...EXECUTION_TARGET_DEFAULTS,
  serverId: "1",
  method: "worker",
  workerName: "w",
}
const ctx = { kind: "schedule" as const, workflowRunner: false, inlineAvailable: true }

describe("validateExecutionTarget", () => {
  it("accepts a complete registered-worker target", () => {
    expect(validateExecutionTarget(worker, ctx)).toEqual({ errors: {}, argsWarnings: [] })
  })

  it("requires a server and the fields of the selected method only", () => {
    expect(
      validateExecutionTarget({ ...worker, serverId: "", workerName: "" }, ctx).errors,
    ).toEqual({
      serverId: { key: "common.formErrors.required" },
      workerName: { key: "common.formErrors.required" },
    })
    expect(
      validateExecutionTarget({ ...worker, method: "workflowUrl", workflowUrl: "" }, ctx).errors,
    ).toEqual({ workflowUrl: { key: "common.formErrors.required" } })
    expect(
      validateExecutionTarget(
        { ...worker, method: "workflowInline", definition: "", managedWorkerName: "" },
        ctx,
      ).errors,
    ).toEqual({
      definition: { key: "common.formErrors.required" },
      managedWorkerName: { key: "common.formErrors.required", values: { max: 128 } },
    })
  })

  it("checks the definition syntax and the stored worker name", () => {
    const { errors } = validateExecutionTarget(
      { ...worker, method: "workflowInline", definition: "a: [", managedWorkerName: "9bad" },
      ctx,
    )
    expect(errors.definition?.key).toBe("executionTarget.definition.errors.syntax")
    expect(errors.definition?.line).toBe(1)
    expect(errors.managedWorkerName?.key).toBe("executionTarget.errors.workerNameSyntax")
  })

  it("refuses an inline definition where the server has no jobworkerp link", () => {
    expect(
      validateExecutionTarget(
        { ...worker, method: "workflowInline", definition: "do: []", managedWorkerName: "w" },
        { ...ctx, inlineAvailable: false },
      ).errors.method?.key,
    ).toBe("executionTarget.errors.inlineUnavailable")
  })

  describe("Slack workflow URLs", () => {
    const slack = { ...ctx, kind: "slackHandler" as const }
    const url = (workflowUrl: string) =>
      validateExecutionTarget({ ...worker, method: "workflowUrl", workflowUrl }, slack).errors
        .workflowUrl?.key

    it.each(["http://h/f.yaml", "https://h/f.yaml", "file:///w/f.yaml"])("accepts %s", (u) => {
      expect(url(u)).toBeUndefined()
    })

    it.each([
      ["another scheme", "ftp://h/f.yaml"],
      ["a bare path", "/w/f.yaml"],
      ["a parent reference", "file:///w/../etc/f.yaml"],
    ])("rejects %s", (_label, u) => {
      expect(url(u)).toBe("executionTarget.errors.slackWorkflowUrl")
    })

    it("limits the length to 2048", () => {
      const head = "https://h/"
      expect(url(head + "a".repeat(SLACK_WORKFLOW_URL_MAX - head.length))).toBeUndefined()
      expect(url(head + "a".repeat(SLACK_WORKFLOW_URL_MAX - head.length + 1))).toBe(
        "executionTarget.errors.slackWorkflowUrl",
      )
    })

    it("does not apply to schedules", () => {
      expect(
        validateExecutionTarget({ ...worker, method: "workflowUrl", workflowUrl: "/w/f.yaml" }, ctx)
          .errors.workflowUrl,
      ).toBeUndefined()
    })
  })

  it("reports argument errors and warnings", () => {
    expect(validateExecutionTarget({ ...worker, args: "{" }, ctx).errors.args?.key).toBe(
      "executionTarget.args.errors.invalidJson",
    )
    expect(
      validateExecutionTarget(
        { ...worker, args: '{"input":"x"}' },
        { ...ctx, workflowRunner: true },
      ).argsWarnings,
    ).toEqual(["input"])
  })
})
