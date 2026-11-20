import type { CallOptions } from "nice-grpc-common"
import type { ConductorClients } from "@/lib/clients"
import type { ListQuery } from "@/lib/executions/filter"
import { sourceTypeOf, type SourceKind } from "@/lib/executions/source"
import { interpretTrigger, type TriggerOutcome } from "@/lib/executions/status"
import {
  ExecutionSourceType,
  type ExecutionRef,
  type ExecutionRuntimeStatus,
} from "@/lib/grpc/jobworkerp_conductor/data/execution_ref"
import { collect } from "./common"

/**
 * Runs a schedule now, enabled or not (as conductor allows). `argsJson`
 * replaces the schedule's args for this run; it is not merged with them.
 */
export async function triggerSchedule(
  c: ConductorClients,
  id: string,
  argsJson?: string,
): Promise<TriggerOutcome> {
  return interpretTrigger(
    await c.executionStatus.triggerExecution({
      sourceType: ExecutionSourceType.EXECUTION_SOURCE_TYPE_CRON_SCHEDULER,
      sourceId: id,
      argsJson,
    }),
  )
}

export interface ExecutionPage {
  rows: ExecutionRef[]
  /** All matching executions; unknown for one source's list, which has no count. */
  total?: number
  hasNext: boolean
}

/** One page of executions, newest first (spec §6.6); statuses are resolved separately. */
export async function listExecutions(
  c: ConductorClients,
  query: ListQuery,
  options?: CallOptions,
): Promise<ExecutionPage> {
  if (query.kind === "bySource") {
    // No count for one source: one row more than a page tells whether another follows.
    const pageSize = query.request.limit ?? 0
    const request = { ...query.request, limit: pageSize + 1 }
    const rows = await collect(c.executionStatus.findListBySource(request, options))
    return { rows: rows.slice(0, pageSize), hasNext: rows.length > pageSize }
  }
  const [rows, count] = await Promise.all([
    collect(c.executionStatus.findList(query.request, options)),
    c.executionStatus.countList(query.request, options),
  ])
  const total = Number(count.total)
  return { rows, total, hasNext: Number(query.request.offset ?? 0) + rows.length < total }
}

export async function findExecution(
  c: ConductorClients,
  id: string,
  options?: CallOptions,
): Promise<ExecutionRef | undefined> {
  return (await c.executionStatus.findExecutionRef({ value: id }, options)).data
}

/**
 * The status conductor resolves now, asking jobworkerp; there is no batch
 * form, so lists ask for each row they show.
 */
export async function findRuntimeStatus(
  c: ConductorClients,
  id: string,
  options?: CallOptions,
): Promise<ExecutionRuntimeStatus | undefined> {
  return (await c.executionStatus.findRuntimeStatus({ id: { value: id } }, options)).data
}

export async function findLatestStatusBySource(
  c: ConductorClients,
  kind: SourceKind,
  sourceId: string,
  options?: CallOptions,
): Promise<ExecutionRuntimeStatus | undefined> {
  const request = { sourceType: sourceTypeOf(kind), sourceId }
  return (await c.executionStatus.findLatestRuntimeStatusBySource(request, options)).data
}

/**
 * Asks jobworkerp to cancel the job; false when it had nothing to cancel
 * (already finished). Only call it where executionActions allows: conductor
 * answers a missing execution or job id with INTERNAL.
 */
export async function cancelExecution(c: ConductorClients, id: string): Promise<boolean> {
  return (await c.executionStatus.cancelExecution({ value: id })).isSuccess
}

/** Runs the schedule behind an execution again, with its current settings (not the old args). */
export async function reExecute(c: ConductorClients, id: string): Promise<TriggerOutcome> {
  return interpretTrigger(await c.executionStatus.reExecute({ value: id }))
}

/**
 * Deletes a finished execution; false when it was already gone. conductor
 * refuses one that is not finished (FAILED_PRECONDITION).
 */
export async function deleteExecution(c: ConductorClients, id: string): Promise<boolean> {
  return (await c.executionStatus.deleteExecutionRef({ value: id })).isSuccess
}

/**
 * Deletes a source's executions and returns how many went. Unless
 * `includeActive`, conductor keeps those not finished (asking jobworkerp
 * about each).
 */
export async function deleteExecutionsBySource(
  c: ConductorClients,
  kind: SourceKind,
  sourceId: string,
  includeActive: boolean,
): Promise<number> {
  const response = await c.executionStatus.deleteExecutionRefsBySource({
    sourceType: sourceTypeOf(kind),
    sourceId,
    includeActive,
  })
  return Number(response.deleted)
}
