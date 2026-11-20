import { describe, expect, it } from "vitest"
import {
  ExecutionSourceType as T,
  ResolvedExecutionStatus as S,
} from "@/lib/grpc/jobworkerp_conductor/data/execution_ref"
import { executionActions } from "./actions"

const ALL = Object.values(S).filter((s): s is S => typeof s === "number" && s >= 0)
const CANCELLABLE = [
  S.RESOLVED_EXECUTION_STATUS_PENDING,
  S.RESOLVED_EXECUTION_STATUS_RUNNING,
  S.RESOLVED_EXECUTION_STATUS_WAIT_RESULT,
]
const DELETABLE = [
  S.RESOLVED_EXECUTION_STATUS_SUCCEEDED,
  S.RESOLVED_EXECUTION_STATUS_FAILED,
  S.RESOLVED_EXECUTION_STATUS_CANCELLED,
  S.RESOLVED_EXECUTION_STATUS_ENQUEUE_FAILED,
]
const CRON = T.EXECUTION_SOURCE_TYPE_CRON_SCHEDULER

describe("executionActions", () => {
  it("cancels only waiting or running work whose job id is known", () => {
    for (const status of ALL) {
      for (const jobId of ["42", undefined]) {
        const { cancel } = executionActions(status, { jobId, sourceType: CRON })
        expect(cancel.allowed, `${status} ${jobId}`).toBe(
          CANCELLABLE.includes(status) && jobId !== undefined,
        )
      }
    }
  })

  it("explains why cancelling is not offered", () => {
    expect(
      executionActions(S.RESOLVED_EXECUTION_STATUS_RUNNING, { jobId: undefined, sourceType: CRON })
        .cancel,
    ).toEqual({ allowed: false, reason: "executions.reasons.noJobId" })
    expect(
      executionActions(S.RESOLVED_EXECUTION_STATUS_SUCCEEDED, { jobId: "1", sourceType: CRON })
        .cancel,
    ).toEqual({ allowed: false, reason: "executions.reasons.notCancellable" })
  })

  it("re-runs only what a schedule started, whatever its status", () => {
    for (const status of ALL) {
      for (const sourceType of [
        T.EXECUTION_SOURCE_TYPE_CRON_SCHEDULER,
        T.EXECUTION_SOURCE_TYPE_SLACK_EVENT_HANDLER,
        T.EXECUTION_SOURCE_TYPE_WORKER_RESULT_HANDLER,
      ]) {
        const { reExecute } = executionActions(status, { jobId: "1", sourceType })
        expect(reExecute.allowed, `${status} ${sourceType}`).toBe(sourceType === CRON)
      }
    }
    expect(
      executionActions(S.RESOLVED_EXECUTION_STATUS_SUCCEEDED, {
        jobId: "1",
        sourceType: T.EXECUTION_SOURCE_TYPE_SLACK_EVENT_HANDLER,
      }).reExecute,
    ).toEqual({ allowed: false, reason: "executions.reasons.notSchedule" })
  })

  it("deletes only finished executions, with or without a job id", () => {
    for (const status of ALL) {
      for (const jobId of ["42", undefined]) {
        const { delete: remove } = executionActions(status, { jobId, sourceType: CRON })
        expect(remove.allowed, `${status} ${jobId}`).toBe(DELETABLE.includes(status))
      }
    }
    expect(
      executionActions(S.RESOLVED_EXECUTION_STATUS_UNAVAILABLE, { jobId: "1", sourceType: CRON })
        .delete,
    ).toEqual({ allowed: false, reason: "executions.reasons.notFinished" })
  })
})
