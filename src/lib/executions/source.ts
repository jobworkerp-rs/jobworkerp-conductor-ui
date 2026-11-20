import type { ConfigKind } from "@/lib/execution-target/form"
import { ExecutionSourceType as T } from "@/lib/grpc/jobworkerp_conductor/data/execution_ref"

/** The settings that start executions, by the names the URLs use. */
export type SourceKind = ConfigKind

export const SOURCE_KINDS: readonly SourceKind[] = ["schedule", "slackHandler", "resultHandler"]

const TYPES: Record<SourceKind, T> = {
  schedule: T.EXECUTION_SOURCE_TYPE_CRON_SCHEDULER,
  slackHandler: T.EXECUTION_SOURCE_TYPE_SLACK_EVENT_HANDLER,
  resultHandler: T.EXECUTION_SOURCE_TYPE_WORKER_RESULT_HANDLER,
}

export const sourceTypeOf = (kind: SourceKind): T => TYPES[kind]

export function sourceKindOf(type: T): SourceKind | undefined {
  return SOURCE_KINDS.find((kind) => TYPES[kind] === type)
}

export const isSourceKind = (value: string | null): value is SourceKind =>
  SOURCE_KINDS.some((kind) => kind === value)

/** An execution's id; conductor always sets it, so "" only stands in for the type. */
export const executionId = (execution: { id?: { value: string } }) => execution.id?.value ?? ""

export const executionPath = (id: string) => `/executions/${encodeURIComponent(id)}`

/** The execution list showing one setting's executions (its history). */
export const executionHistoryPath = (kind: SourceKind, id: string) =>
  `/executions?sourceType=${kind}&sourceId=${encodeURIComponent(id)}`
