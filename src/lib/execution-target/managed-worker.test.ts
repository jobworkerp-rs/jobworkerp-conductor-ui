import { describe, expect, it } from "vitest"
import { QueueType, ResponseType, RetryType } from "@/lib/grpc/jobworkerp/data/common"
import {
  MANAGED_WORKER_NAME_MAX,
  defaultManagedWorkerName,
  hasManagedWorkerName,
  isManagedWorker,
  managedWorkerData,
  managedWorkerDescription,
  validateManagedWorkerName,
} from "./managed-worker"

describe("defaultManagedWorkerName", () => {
  it("joins the prefix, the kind and a slug of the setting name", () => {
    expect(defaultManagedWorkerName("schedule", "daily-report")).toBe(
      "conductor-schedule-daily-report",
    )
    expect(defaultManagedWorkerName("slackHandler", "summarize_thread")).toBe(
      "conductor-slack-summarize_thread",
    )
    expect(defaultManagedWorkerName("resultHandler", "on-done")).toBe("conductor-result-on-done")
  })

  it("adds a stable hash when the slug loses characters, so distinct names stay distinct", () => {
    const a = defaultManagedWorkerName("schedule", "Daily Report")
    const b = defaultManagedWorkerName("schedule", "daily report")
    expect(a).toMatch(/^conductor-schedule-daily-report-[0-9a-z]+$/)
    expect(a).not.toBe(b)
    expect(defaultManagedWorkerName("schedule", "Daily Report")).toBe(a)
  })

  it("falls back to the hash for names without ASCII letters or digits", () => {
    expect(defaultManagedWorkerName("schedule", "日次レポート")).toMatch(
      /^conductor-schedule-[0-9a-z]+$/,
    )
  })

  it("stays within the length limit and the jobworkerp name syntax", () => {
    const name = defaultManagedWorkerName("schedule", "x".repeat(300))
    expect(name.length).toBeLessThanOrEqual(MANAGED_WORKER_NAME_MAX)
    expect(validateManagedWorkerName(name)).toBeUndefined()
  })
})

describe("validateManagedWorkerName", () => {
  it("follows the jobworkerp worker name syntax", () => {
    expect(validateManagedWorkerName("")).toBe("common.formErrors.required")
    expect(validateManagedWorkerName("1abc")).toBe("executionTarget.errors.workerNameSyntax")
    expect(validateManagedWorkerName("a b")).toBe("executionTarget.errors.workerNameSyntax")
    expect(validateManagedWorkerName("a".repeat(MANAGED_WORKER_NAME_MAX + 1))).toBe(
      "common.formErrors.tooLong",
    )
    expect(validateManagedWorkerName("conductor-x_1")).toBeUndefined()
  })
})

describe("managed worker identification", () => {
  // Users may rename the worker, so only the description tells ownership.
  it("recognizes workers by the description marker", () => {
    expect(isManagedWorker({ description: managedWorkerDescription("schedule", "daily") })).toBe(
      true,
    )
    expect(isManagedWorker({ description: "made by hand" })).toBe(false)
  })
})

describe("managedWorkerData", () => {
  it("uses conductor's options for workflow workers with the given channel", () => {
    const data = managedWorkerData({
      name: "conductor-schedule-daily",
      description: "d",
      runnerId: "7",
      runnerSettings: new Uint8Array([1, 2]),
      channel: "batch",
    })
    expect(data).toEqual({
      name: "conductor-schedule-daily",
      description: "d",
      runnerId: { value: "7" },
      runnerSettings: new Uint8Array([1, 2]),
      retryPolicy: {
        type: RetryType.EXPONENTIAL,
        interval: 800,
        maxInterval: 60000,
        maxRetry: 1,
        basis: 2,
      },
      periodicInterval: 0,
      channel: "batch",
      queueType: QueueType.NORMAL,
      responseType: ResponseType.DIRECT,
      storeSuccess: false,
      storeFailure: true,
      useStatic: false,
      broadcastResults: true,
    })
  })

  it("leaves the channel unset when empty", () => {
    expect(
      managedWorkerData({
        name: "n",
        description: "d",
        runnerId: "7",
        runnerSettings: new Uint8Array(),
        channel: "",
      }).channel,
    ).toBeUndefined()
  })
})

describe("hasManagedWorkerName", () => {
  it("tells names made by defaultManagedWorkerName", () => {
    expect(hasManagedWorkerName(defaultManagedWorkerName("resultHandler", "x"))).toBe(true)
    expect(hasManagedWorkerName("conductor_cron-scheduler_create")).toBe(false)
    expect(hasManagedWorkerName("summarize")).toBe(false)
  })
})
