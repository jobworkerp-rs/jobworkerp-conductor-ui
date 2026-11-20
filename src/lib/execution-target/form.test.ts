import { describe, expect, it } from "vitest"
import {
  EXECUTION_TARGET_DEFAULTS,
  fromStoredTarget,
  runsWorkflow,
  toStoredTarget,
  type ExecutionTargetForm,
} from "./form"

const base: ExecutionTargetForm = {
  ...EXECUTION_TARGET_DEFAULTS,
  serverId: "10",
  workerName: "report-generator",
  using: "run",
  workflowUrl: "https://example.com/flow.yaml",
  channel: "batch",
  definition: "do: []",
  managedWorkerName: "conductor-schedule-daily",
  args: '{"a":1}',
}

describe("EXECUTION_TARGET_DEFAULTS", () => {
  it("starts with a registered worker", () => {
    expect(EXECUTION_TARGET_DEFAULTS.method).toBe("worker")
  })
})

describe("toStoredTarget", () => {
  it("sends only the worker for a registered worker", () => {
    expect(toStoredTarget({ ...base, method: "worker" })).toEqual({
      workflowUrl: "",
      channel: undefined,
      workflow: undefined,
      worker: { workerName: "report-generator", using: "run" },
      args: '{"a":1}',
    })
  })

  it("omits an empty using and empty args", () => {
    expect(toStoredTarget({ ...base, method: "worker", using: "", args: "  " })).toMatchObject({
      worker: { workerName: "report-generator", using: undefined },
      args: undefined,
    })
  })

  it("sends only the workflow URL and channel for the URL method", () => {
    expect(toStoredTarget({ ...base, method: "workflowUrl" })).toEqual({
      workflowUrl: "",
      channel: undefined,
      workflow: { workflowUrl: "https://example.com/flow.yaml", channel: "batch" },
      worker: undefined,
      args: '{"a":1}',
    })
    expect(toStoredTarget({ ...base, method: "workflowUrl", channel: "" }).workflow).toEqual({
      workflowUrl: "https://example.com/flow.yaml",
      channel: undefined,
    })
  })

  it("runs the managed worker with using=run for an inline definition", () => {
    // The channel lives on the managed worker, since the target has no channel field.
    expect(toStoredTarget({ ...base, method: "workflowInline" })).toEqual({
      workflowUrl: "",
      channel: undefined,
      workflow: undefined,
      worker: { workerName: "conductor-schedule-daily", using: "run" },
      args: '{"a":1}',
    })
  })

  it("trims names and URLs", () => {
    expect(
      toStoredTarget({ ...base, method: "worker", workerName: " w ", using: " run " }).worker,
    ).toEqual({ workerName: "w", using: "run" })
  })
})

describe("fromStoredTarget", () => {
  it("reads a registered worker", () => {
    expect(
      fromStoredTarget({
        serverId: "10",
        stored: { workflowUrl: "", worker: { workerName: "w", using: "chat" }, args: "{}" },
      }),
    ).toEqual({
      ...EXECUTION_TARGET_DEFAULTS,
      serverId: "10",
      method: "worker",
      workerName: "w",
      using: "chat",
      args: "{}",
    })
  })

  it("reads the URL method", () => {
    expect(
      fromStoredTarget({
        serverId: "10",
        stored: { workflowUrl: "", workflow: { workflowUrl: "file:///f.yaml", channel: "c" } },
      }),
    ).toMatchObject({ method: "workflowUrl", workflowUrl: "file:///f.yaml", channel: "c" })
  })

  it("reads data that has only the deprecated top-level fields as the URL method", () => {
    expect(
      fromStoredTarget({
        serverId: "10",
        stored: { workflowUrl: "https://old/flow.yaml", channel: "legacy" },
      }),
    ).toMatchObject({
      method: "workflowUrl",
      workflowUrl: "https://old/flow.yaml",
      channel: "legacy",
    })
  })

  it("reads a managed worker as an inline definition when the caller found one", () => {
    expect(
      fromStoredTarget({
        serverId: "10",
        stored: { workflowUrl: "", worker: { workerName: "conductor-schedule-x", using: "run" } },
        managed: { definition: "do: []", channel: "batch" },
      }),
    ).toMatchObject({
      method: "workflowInline",
      managedWorkerName: "conductor-schedule-x",
      definition: "do: []",
      channel: "batch",
      workerName: "",
    })
  })
})

describe("runsWorkflow", () => {
  it("is true for both workflow methods and for a WORKFLOW-runner worker", () => {
    expect(runsWorkflow("workflowUrl", false)).toBe(true)
    expect(runsWorkflow("workflowInline", false)).toBe(true)
    expect(runsWorkflow("worker", true)).toBe(true)
    expect(runsWorkflow("worker", false)).toBe(false)
  })
})
