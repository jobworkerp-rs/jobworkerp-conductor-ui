import {
  ExecutionSourceType,
  ResolvedExecutionStatus as S,
  type ExecutionRef,
} from "@/lib/grpc/jobworkerp_conductor/data/execution_ref"
import { isTerminalStatus } from "./status"

export type Availability = { allowed: true } | { allowed: false; reason: string }

const ALLOWED: Availability = { allowed: true }
const refused = (reason: string): Availability => ({
  allowed: false,
  reason: `executions.reasons.${reason}`,
})

// jobworkerp can only cancel a job it knows; CANCELLING is already on its way.
const CANCELLABLE = new Set<S>([
  S.RESOLVED_EXECUTION_STATUS_PENDING,
  S.RESOLVED_EXECUTION_STATUS_RUNNING,
  S.RESOLVED_EXECUTION_STATUS_WAIT_RESULT,
])

/**
 * What can be done with an execution (spec §6.6), with the reason when not.
 * Checked before calling conductor, which answers a cancel without a job id
 * with INTERNAL instead of refusing it.
 */
export function executionActions(status: S, ref: Pick<ExecutionRef, "jobId" | "sourceType">) {
  return {
    cancel: !CANCELLABLE.has(status)
      ? refused("notCancellable")
      : ref.jobId === undefined
        ? refused("noJobId")
        : ALLOWED,
    reExecute:
      ref.sourceType === ExecutionSourceType.EXECUTION_SOURCE_TYPE_CRON_SCHEDULER
        ? ALLOWED
        : refused("notSchedule"),
    delete: isTerminalStatus(status) ? ALLOWED : refused("notFinished"),
  }
}
