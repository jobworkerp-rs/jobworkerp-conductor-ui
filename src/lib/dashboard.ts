import { isActiveStatus, isFailedStatus } from "@/lib/executions/status"
import type { ResolvedExecutionStatus } from "@/lib/grpc/jobworkerp_conductor/data/execution_ref"
import { soonestRuns, type CronRulesState, type NextRunState } from "@/lib/schedules/list"

/** How many recent executions the dashboard resolves, newest first (spec §6.1). */
export const RECENT_CONSIDERED = 50
/** How many of them, running or failed, it lists. */
export const RECENT_SHOWN = 10
export const NEXT_RUNS_SHOWN = 5

/**
 * The recent executions worth attention: still running, or failed. A status
 * is undefined until it loads and null for an execution gone meanwhile;
 * `pending` says the picks may still grow, so "none" is not yet the answer.
 */
export function pickRecentExecutions<T>(
  rows: readonly T[],
  statusOf: (row: T) => ResolvedExecutionStatus | null | undefined,
): { rows: T[]; pending: boolean } {
  const picked = rows
    .filter((row) => {
      const status = statusOf(row)
      return status != null && (isActiveStatus(status) || isFailedStatus(status))
    })
    .slice(0, RECENT_SHOWN)
  const pending = picked.length < RECENT_SHOWN && rows.some((row) => statusOf(row) === undefined)
  return { rows: picked, pending }
}

/**
 * What the next-runs card shows: the soonest runs once both conductor's cron
 * rules and the schedules are in, so "none due" is never said early.
 */
export function nextRunsView(
  rules: CronRulesState,
  schedules: readonly { id: string; data: { name: string } }[] | undefined,
  nextRuns: ReadonlyMap<string, NextRunState>,
): "failed" | "loading" | ReturnType<typeof soonestRuns> {
  if (rules === "failed") return "failed"
  if (rules === "loading" || !schedules) return "loading"
  return soonestRuns(schedules, nextRuns, NEXT_RUNS_SHOWN)
}
