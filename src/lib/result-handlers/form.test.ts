import { describe, expect, it } from "vitest"
import { EXECUTION_TARGET_DEFAULTS } from "@/lib/execution-target/form"
import { hasErrors } from "@/lib/validation"
import type { ExecutionTargetContext } from "@/lib/execution-target/validate"
import {
  RESULT_HANDLER_FORM_DEFAULTS,
  followListenServer,
  toResultHandlerData,
  toResultHandlerForm,
  validateResultHandlerForm,
  type ResultHandlerFormValues,
} from "./form"

const context: ExecutionTargetContext = {
  kind: "resultHandler",
  workflowRunner: false,
  inlineAvailable: true,
}

const valid: ResultHandlerFormValues = {
  ...RESULT_HANDLER_FORM_DEFAULTS,
  name: "on-crawl-finished",
  listenServerId: "1",
  listenWorkerName: "crawler",
  target: {
    ...EXECUTION_TARGET_DEFAULTS,
    serverId: "2",
    method: "worker",
    workerName: "summarize",
  },
}

describe("RESULT_HANDLER_FORM_DEFAULTS", () => {
  it("is enabled and runs a registered worker", () => {
    expect(RESULT_HANDLER_FORM_DEFAULTS.enabled).toBe(true)
    expect(RESULT_HANDLER_FORM_DEFAULTS.target.method).toBe("worker")
  })
})

describe("validateResultHandlerForm", () => {
  it("accepts valid values", () => {
    const errors = validateResultHandlerForm(valid, context)
    expect(errors).toEqual({})
    expect(hasErrors(errors)).toBe(false)
  })

  it("requires the name, the watched server and the watched worker", () => {
    const errors = validateResultHandlerForm(
      { ...valid, name: " ", listenServerId: "", listenWorkerName: "" },
      context,
    )
    expect(errors).toEqual({
      name: { key: "common.formErrors.required" },
      listenServerId: { key: "common.formErrors.required" },
      listenWorkerName: { key: "common.formErrors.required" },
    })
    expect(hasErrors(errors)).toBe(true)
  })

  it("limits the name and description with their maximum", () => {
    const errors = validateResultHandlerForm(
      { ...valid, name: "a".repeat(101), description: "b".repeat(501) },
      context,
    )
    expect(errors.name).toEqual({ key: "common.formErrors.tooLong", values: { max: 100 } })
    expect(errors.description).toEqual({ key: "common.formErrors.tooLong", values: { max: 500 } })
  })

  it("includes the execution target's errors under target", () => {
    const errors = validateResultHandlerForm(
      { ...valid, target: { ...valid.target, workerName: "" } },
      context,
    )
    expect(errors.target).toEqual({ workerName: { key: "common.formErrors.required" } })
    expect(hasErrors(errors)).toBe(true)
  })
})

describe("toResultHandlerData / toResultHandlerForm", () => {
  it("sends the target in the new format, on the target's server, and stamps both times", () => {
    expect(
      toResultHandlerData(
        {
          ...valid,
          name: " on-crawl ",
          listenWorkerName: " crawler ",
          description: " ",
          target: { ...valid.target, args: '{"a":1}' },
        },
        1_700_000_000,
      ),
    ).toEqual({
      name: "on-crawl",
      description: undefined,
      listenJobworkerpServerId: { value: "1" },
      listenWorkerName: "crawler",
      processJobworkerpServerId: { value: "2" },
      workflowUrl: "",
      channel: undefined,
      workflow: undefined,
      worker: { workerName: "summarize", using: undefined },
      args: '{"a":1}',
      enabled: true,
      createdAt: "1700000000",
      updatedAt: "1700000000",
    })
  })

  it("keeps created_at on update", () => {
    expect(toResultHandlerData(valid, 1_800_000_000, "1700000000")).toMatchObject({
      createdAt: "1700000000",
      updatedAt: "1800000000",
    })
  })

  it("reads stored data back into the form", () => {
    const data = toResultHandlerData({ ...valid, description: "d", enabled: false }, 1)
    expect(toResultHandlerForm(data)).toEqual({ ...valid, description: "d", enabled: false })
  })

  it("reads an inline definition when the caller found the managed worker", () => {
    const data = toResultHandlerData(
      {
        ...valid,
        target: {
          ...valid.target,
          method: "workflowInline",
          managedWorkerName: "conductor-result-x",
          definition: "do: []",
        },
      },
      1,
    )
    expect(toResultHandlerForm(data, { definition: "do: []", channel: "" }).target).toMatchObject({
      method: "workflowInline",
      managedWorkerName: "conductor-result-x",
      definition: "do: []",
    })
  })
})

describe("followListenServer", () => {
  it("moves the target server along while it still matches the watched server", () => {
    expect(
      followListenServer(
        { ...valid, listenServerId: "1", target: { ...valid.target, serverId: "1" } },
        "3",
      ),
    ).toMatchObject({
      listenServerId: "3",
      target: { serverId: "3" },
    })
    expect(
      followListenServer(
        { ...valid, listenServerId: "", target: { ...valid.target, serverId: "" } },
        "3",
      ),
    ).toMatchObject({
      target: { serverId: "3" },
    })
  })

  it("leaves a target server the user chose", () => {
    expect(followListenServer(valid, "3")).toMatchObject({
      listenServerId: "3",
      target: { serverId: "2" },
    })
  })
})
