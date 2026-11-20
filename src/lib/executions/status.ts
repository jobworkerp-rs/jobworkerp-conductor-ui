import {
  CircleCheck,
  CircleHelp,
  CircleMinus,
  CircleSlash,
  CircleX,
  Clock,
  CloudOff,
  Hourglass,
  LoaderCircle,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react"
import {
  ExecutionStatusSource,
  ResolvedExecutionStatus as S,
} from "@/lib/grpc/jobworkerp_conductor/data/execution_ref"
import { refetchInterval, type Polling } from "@/lib/refresh"
import type { TriggerExecutionResponse } from "@/lib/grpc/jobworkerp_conductor/service/execution_status"

export type StatusTone = "yellow" | "blue" | "purple" | "orange" | "green" | "red" | "gray"

// Each status's name (its i18n key under executions.status and its value in
// URLs) and look (spec §6.6). Outlined statuses say nothing about the job's
// outcome.
const DISPLAYS = [
  [
    S.RESOLVED_EXECUTION_STATUS_UNSPECIFIED,
    { name: "unspecified", tone: "gray", outline: true, icon: CircleHelp },
  ],
  [S.RESOLVED_EXECUTION_STATUS_PENDING, { name: "pending", tone: "yellow", icon: Clock }],
  [
    S.RESOLVED_EXECUTION_STATUS_RUNNING,
    { name: "running", tone: "blue", icon: LoaderCircle, spinning: true },
  ],
  [
    S.RESOLVED_EXECUTION_STATUS_WAIT_RESULT,
    { name: "waitResult", tone: "purple", icon: Hourglass },
  ],
  [
    S.RESOLVED_EXECUTION_STATUS_CANCELLING,
    { name: "cancelling", tone: "orange", icon: CircleSlash },
  ],
  [S.RESOLVED_EXECUTION_STATUS_SUCCEEDED, { name: "succeeded", tone: "green", icon: CircleCheck }],
  [S.RESOLVED_EXECUTION_STATUS_FAILED, { name: "failed", tone: "red", icon: CircleX }],
  [S.RESOLVED_EXECUTION_STATUS_CANCELLED, { name: "cancelled", tone: "gray", icon: CircleMinus }],
  [
    S.RESOLVED_EXECUTION_STATUS_UNKNOWN,
    { name: "unknown", tone: "gray", outline: true, icon: CircleHelp },
  ],
  [
    S.RESOLVED_EXECUTION_STATUS_UNAVAILABLE,
    { name: "unavailable", tone: "gray", outline: true, icon: CloudOff },
  ],
  [
    S.RESOLVED_EXECUTION_STATUS_ENQUEUE_FAILED,
    { name: "enqueueFailed", tone: "red", outline: true, icon: TriangleAlert },
  ],
] as const satisfies readonly (readonly [
  S,
  { name: string; tone: StatusTone; outline?: boolean; icon: LucideIcon; spinning?: boolean },
])[]

export type StatusName = (typeof DISPLAYS)[number][1]["name"]

export interface StatusDisplay {
  name: StatusName
  tone: StatusTone
  outline?: boolean
  icon: LucideIcon
  spinning?: boolean
}

export const STATUS_NAMES: readonly StatusName[] = DISPLAYS.map(([, display]) => display.name)

const BY_STATUS = new Map<S, StatusDisplay>(DISPLAYS)

/** How a status is shown; statuses this UI does not know read as unspecified. */
export function statusDisplay(status: S): StatusDisplay {
  return BY_STATUS.get(status) ?? DISPLAYS[0][1]
}

/** The i18n key of a status name. */
export const statusNameKey = (name: StatusName) => `executions.status.${name}`

/** The i18n key of an execution's status. */
export const executionStatusKey = (status: S) => statusNameKey(statusDisplay(status).name)

export function statusOfName(name: string): S | undefined {
  return DISPLAYS.find(([, display]) => display.name === name)?.[0]
}

const ACTIVE = new Set<S>([
  S.RESOLVED_EXECUTION_STATUS_PENDING,
  S.RESOLVED_EXECUTION_STATUS_RUNNING,
  S.RESOLVED_EXECUTION_STATUS_WAIT_RESULT,
  S.RESOLVED_EXECUTION_STATUS_CANCELLING,
])
// What conductor treats as finished: deletable, and no longer changing.
const TERMINAL = new Set<S>([
  S.RESOLVED_EXECUTION_STATUS_SUCCEEDED,
  S.RESOLVED_EXECUTION_STATUS_FAILED,
  S.RESOLVED_EXECUTION_STATUS_CANCELLED,
  S.RESOLVED_EXECUTION_STATUS_ENQUEUE_FAILED,
])

const FAILED = new Set<S>([
  S.RESOLVED_EXECUTION_STATUS_FAILED,
  S.RESOLVED_EXECUTION_STATUS_ENQUEUE_FAILED,
])

/** Failed, whether the job itself or its enqueue. */
export const isFailedStatus = (status: S) => FAILED.has(status)

/** Still in progress, so worth polling quickly (spec §4.3). */
export const isActiveStatus = (status: S) => ACTIVE.has(status)
export const isTerminalStatus = (status: S) => TERMINAL.has(status)

/** Keeps an execution gone (null) apart from one whose status is still loading (undefined). */
export const resolvedStatusOf = (status: { resolvedStatus: S } | null | undefined) =>
  status === null ? null : status?.resolvedStatus

export type TriggerOutcome =
  | { accepted: true; refId?: string; status: S }
  | { accepted: false; refId?: string; error?: string }

/**
 * conductor answers a run whose job could not be enqueued with success and
 * the ENQUEUE_FAILED status, so the call alone does not tell.
 */
export function interpretTrigger({
  executionRefId,
  status,
}: TriggerExecutionResponse): TriggerOutcome {
  const refId = executionRefId?.value
  if (status?.resolvedStatus === S.RESOLVED_EXECUTION_STATUS_ENQUEUE_FAILED) {
    return { accepted: false, refId, error: status.executionRef?.enqueueError ?? status.detail }
  }
  return {
    accepted: true,
    refId,
    status: status?.resolvedStatus ?? S.RESOLVED_EXECUTION_STATUS_UNSPECIFIED,
  }
}

/**
 * How often to ask for an execution's status again (spec §4.3): every few
 * seconds while it runs, never once it has finished, and at the idle pace
 * while it cannot be told (e.g. jobworkerp unreachable). `pollFinished` is
 * for a setting's latest execution, which a newer run replaces.
 */
export function statusRefetchInterval(
  state: Polling & { status: S | undefined; pollFinished?: boolean },
): number | false {
  if (state.status !== undefined && isTerminalStatus(state.status) && !state.pollFinished) {
    return false
  }
  return refetchInterval({
    autoRefresh: state.autoRefresh,
    idleMs: state.idleMs,
    hasActive: state.status !== undefined && isActiveStatus(state.status),
  })
}

const SOURCE_NAMES: Partial<Record<ExecutionStatusSource, string>> = {
  [ExecutionStatusSource.EXECUTION_STATUS_SOURCE_JOB_PROCESSING_STATUS]: "jobProcessingStatus",
  [ExecutionStatusSource.EXECUTION_STATUS_SOURCE_JOB_RESULT]: "jobResult",
  [ExecutionStatusSource.EXECUTION_STATUS_SOURCE_EXECUTION_REF]: "executionRef",
  [ExecutionStatusSource.EXECUTION_STATUS_SOURCE_UNAVAILABLE]: "unavailable",
}

/** The i18n key naming where conductor observed a status. */
export function statusSourceKey(source: ExecutionStatusSource): string {
  return `executions.statusSources.${SOURCE_NAMES[source] ?? "unspecified"}`
}
