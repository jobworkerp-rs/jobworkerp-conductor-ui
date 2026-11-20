import { describe, expect, it } from "vitest"
import {
  ExecutionSourceType,
  ExecutionStatusSource,
  ResolvedExecutionStatus as S,
  type ExecutionRuntimeStatus,
} from "@/lib/grpc/jobworkerp_conductor/data/execution_ref"
import en from "@/locales/en/translation.json"
import {
  STATUS_NAMES,
  executionStatusKey,
  interpretTrigger,
  isActiveStatus,
  isFailedStatus,
  isTerminalStatus,
  resolvedStatusOf,
  statusDisplay,
  statusOfName,
  statusRefetchInterval,
  statusSourceKey,
} from "./status"

const ALL = Object.values(S).filter((s): s is S => typeof s === "number")

describe("statusDisplay", () => {
  it("gives every status a label, a colour and an icon (spec §6.6)", () => {
    for (const status of ALL) {
      const display = statusDisplay(status)
      expect(en.executions.status[display.name], `${status}`).toBeDefined()
      expect(display.tone, `${status}`).toMatch(/.+/)
      expect(display.icon, `${status}`).toBeDefined()
    }
  })

  it("follows the spec's colours, outlining the statuses that are not outcomes", () => {
    expect(statusDisplay(S.RESOLVED_EXECUTION_STATUS_RUNNING)).toMatchObject({
      tone: "blue",
      spinning: true,
    })
    expect(statusDisplay(S.RESOLVED_EXECUTION_STATUS_FAILED)).toMatchObject({ tone: "red" })
    expect(statusDisplay(S.RESOLVED_EXECUTION_STATUS_FAILED).outline).toBeFalsy()
    expect(statusDisplay(S.RESOLVED_EXECUTION_STATUS_ENQUEUE_FAILED)).toMatchObject({
      tone: "red",
      outline: true,
    })
    for (const status of [
      S.RESOLVED_EXECUTION_STATUS_UNKNOWN,
      S.RESOLVED_EXECUTION_STATUS_UNAVAILABLE,
    ]) {
      expect(statusDisplay(status)).toMatchObject({ tone: "gray", outline: true })
    }
  })
})

describe("isActiveStatus / isTerminalStatus", () => {
  it("tells running work from finished work, and neither for unknown states", () => {
    const active = ALL.filter(isActiveStatus)
    const terminal = ALL.filter(isTerminalStatus)
    expect(active).toEqual([
      S.RESOLVED_EXECUTION_STATUS_PENDING,
      S.RESOLVED_EXECUTION_STATUS_RUNNING,
      S.RESOLVED_EXECUTION_STATUS_WAIT_RESULT,
      S.RESOLVED_EXECUTION_STATUS_CANCELLING,
    ])
    expect(terminal).toEqual([
      S.RESOLVED_EXECUTION_STATUS_SUCCEEDED,
      S.RESOLVED_EXECUTION_STATUS_FAILED,
      S.RESOLVED_EXECUTION_STATUS_CANCELLED,
      S.RESOLVED_EXECUTION_STATUS_ENQUEUE_FAILED,
    ])
  })
})

describe("statusRefetchInterval", () => {
  it("polls running work quickly, unsettled states slowly and finished work never", () => {
    const at = (status: S | undefined, autoRefresh = true) =>
      statusRefetchInterval({ autoRefresh, idleMs: 30_000, status })
    expect(at(S.RESOLVED_EXECUTION_STATUS_RUNNING)).toBe(5_000)
    expect(at(S.RESOLVED_EXECUTION_STATUS_UNAVAILABLE)).toBe(30_000)
    expect(at(undefined)).toBe(30_000)
    expect(at(S.RESOLVED_EXECUTION_STATUS_SUCCEEDED)).toBe(false)
    expect(at(S.RESOLVED_EXECUTION_STATUS_RUNNING, false)).toBe(false)
  })

  it("polls unsettled states at the chosen interval", () => {
    expect(
      statusRefetchInterval({
        autoRefresh: true,
        idleMs: 60_000,
        status: S.RESOLVED_EXECUTION_STATUS_UNAVAILABLE,
      }),
    ).toBe(60_000)
  })

  it("keeps watching for newer runs when following a setting's latest execution", () => {
    expect(
      statusRefetchInterval({
        autoRefresh: true,
        idleMs: 30_000,
        status: S.RESOLVED_EXECUTION_STATUS_SUCCEEDED,
        pollFinished: true,
      }),
    ).toBe(30_000)
  })
})

describe("statusSourceKey", () => {
  it("names every place conductor observes a status", () => {
    for (const source of Object.values(ExecutionStatusSource).filter(
      (s): s is ExecutionStatusSource => typeof s === "number",
    )) {
      const name = statusSourceKey(source).replace("executions.statusSources.", "")
      expect(
        en.executions.statusSources[name as keyof typeof en.executions.statusSources],
      ).toBeDefined()
    }
  })
})

describe("isFailedStatus", () => {
  it("is the failures of the job and of its enqueue", () => {
    expect(ALL.filter(isFailedStatus)).toEqual([
      S.RESOLVED_EXECUTION_STATUS_FAILED,
      S.RESOLVED_EXECUTION_STATUS_ENQUEUE_FAILED,
    ])
  })
})

describe("resolvedStatusOf", () => {
  it("keeps an execution gone (null) apart from one still loading (undefined)", () => {
    expect(resolvedStatusOf(null)).toBeNull()
    expect(resolvedStatusOf(undefined)).toBeUndefined()
    expect(resolvedStatusOf({ resolvedStatus: S.RESOLVED_EXECUTION_STATUS_RUNNING })).toBe(
      S.RESOLVED_EXECUTION_STATUS_RUNNING,
    )
  })
})

describe("statusOfName", () => {
  it("round-trips the names used in URLs", () => {
    for (const name of STATUS_NAMES) expect(statusDisplay(statusOfName(name)!).name).toBe(name)
    expect(statusOfName("nope")).toBeUndefined()
  })
})

describe("executionStatusKey", () => {
  it("names every status conductor reports with a translated label", () => {
    const statuses = Object.values(S).filter((s): s is S => typeof s === "number")
    for (const status of statuses) {
      const key = executionStatusKey(status)
      const name = key.replace("executions.status.", "") as keyof typeof en.executions.status
      expect(en.executions.status[name], `${status}`).toBeDefined()
    }
    expect(executionStatusKey(S.RESOLVED_EXECUTION_STATUS_ENQUEUE_FAILED)).toBe(
      "executions.status.enqueueFailed",
    )
    expect(executionStatusKey(S.UNRECOGNIZED)).toBe("executions.status.unspecified")
  })
})

function status(resolvedStatus: S, extra: Partial<ExecutionRuntimeStatus> = {}) {
  return {
    executionRef: {
      id: { value: "7" },
      sourceType: ExecutionSourceType.EXECUTION_SOURCE_TYPE_CRON_SCHEDULER,
      sourceId: "1",
      sourceName: "s",
      jobworkerpServerId: { value: "1" },
      triggeredAt: "0",
      createdAt: "0",
    },
    resolvedStatus,
    statusSource: ExecutionStatusSource.EXECUTION_STATUS_SOURCE_EXECUTION_REF,
    observedAt: "0",
    ...extra,
  }
}

describe("interpretTrigger", () => {
  it("reads an accepted run with its execution and status", () => {
    expect(
      interpretTrigger({
        executionRefId: { value: "7" },
        status: status(S.RESOLVED_EXECUTION_STATUS_PENDING),
      }),
    ).toEqual({ accepted: true, refId: "7", status: S.RESOLVED_EXECUTION_STATUS_PENDING })
  })

  it("reads a failed enqueue, which conductor reports as a successful call", () => {
    const failed = status(S.RESOLVED_EXECUTION_STATUS_ENQUEUE_FAILED, {
      detail: "enqueue failed before job_id was assigned",
    })
    failed.executionRef.enqueueError = "worker not found: missing"
    expect(interpretTrigger({ executionRefId: { value: "7" }, status: failed })).toEqual({
      accepted: false,
      refId: "7",
      error: "worker not found: missing",
    })
  })

  it("falls back to the status detail when the execution has no enqueue error", () => {
    const failed = status(S.RESOLVED_EXECUTION_STATUS_ENQUEUE_FAILED, { detail: "no job" })
    expect(interpretTrigger({ executionRefId: undefined, status: failed })).toEqual({
      accepted: false,
      refId: undefined,
      error: "no job",
    })
  })

  it("treats a response without a status as accepted with an unknown status", () => {
    expect(interpretTrigger({ executionRefId: { value: "7" }, status: undefined })).toEqual({
      accepted: true,
      refId: "7",
      status: S.RESOLVED_EXECUTION_STATUS_UNSPECIFIED,
    })
  })
})
