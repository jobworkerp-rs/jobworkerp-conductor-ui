import type { ResolvedExecutionStatus } from "@/lib/grpc/jobworkerp_conductor/data/execution_ref"
import type {
  ExecutionSourceRequest,
  FindExecutionListRequest,
} from "@/lib/grpc/jobworkerp_conductor/service/execution_status"
import { isSourceKind, sourceTypeOf, type SourceKind } from "./source"
import { STATUS_NAMES, statusOfName, type StatusName } from "./status"

export const PERIODS = ["all", "1h", "24h", "7d", "custom"] as const
export type Period = (typeof PERIODS)[number]

const PERIOD_SECONDS: Partial<Record<Period, number>> = { "1h": 3600, "24h": 86_400, "7d": 604_800 }

/** The execution list's filters, kept in the URL (spec §6.6). */
export interface ExecutionFilter {
  sourceType?: SourceKind
  /** Only with sourceType: one setting's executions. */
  sourceId?: string
  server?: string
  period: Period
  /** datetime-local values (minutes, browser time zone) for a custom period. */
  from?: string
  to?: string
  /** Applied to the page shown only; the API cannot filter by status. */
  status?: StatusName
}

export function parseExecutionFilter(params: URLSearchParams): ExecutionFilter {
  const sourceType = params.get("sourceType")
  const period = params.get("period")
  const status = params.get("status")
  const filter: ExecutionFilter = {
    period: PERIODS.find((p) => p === period) ?? "all",
  }
  if (isSourceKind(sourceType)) {
    filter.sourceType = sourceType
    const sourceId = params.get("sourceId")
    if (sourceId) filter.sourceId = sourceId
  }
  for (const key of ["server", "from", "to"] as const) {
    const value = params.get(key)
    if (value) filter[key] = value
  }
  const name = STATUS_NAMES.find((n) => n === status)
  if (name) filter.status = name
  return filter
}

const localSeconds = (value: string | undefined) => {
  if (!value) return undefined
  const ms = new Date(value).getTime()
  return Number.isNaN(ms) ? undefined : Math.floor(ms / 1000)
}

/**
 * The period as inclusive UNIX-second bounds on when executions were
 * triggered (conductor compares both ends inclusively). A custom end covers
 * its whole minute, as the input has no seconds.
 */
export function periodRange(
  filter: Pick<ExecutionFilter, "period" | "from" | "to">,
  nowSeconds: number,
): { after?: number; before?: number } {
  const span = PERIOD_SECONDS[filter.period]
  if (span !== undefined) return { after: nowSeconds - span, before: nowSeconds }
  if (filter.period !== "custom") return {}
  const after = localSeconds(filter.from)
  const to = localSeconds(filter.to)
  return {
    ...(after !== undefined && { after }),
    ...(to !== undefined && { before: to + 59 }),
  }
}

export type ListQuery =
  | { kind: "list"; request: FindExecutionListRequest }
  | { kind: "bySource"; request: ExecutionSourceRequest }

/**
 * The one setting whose executions are listed, if chosen. Its list API takes
 * neither period nor server and gives no count (spec §6.6).
 */
export function singleSource(
  filter: ExecutionFilter,
): { kind: SourceKind; id: string } | undefined {
  return filter.sourceType && filter.sourceId
    ? { kind: filter.sourceType, id: filter.sourceId }
    : undefined
}

/** The request for one page. */
export function toListQuery(
  filter: ExecutionFilter,
  nowSeconds: number,
  page: number,
  pageSize: number,
): ListQuery {
  const offset = String((page - 1) * pageSize)
  const source = singleSource(filter)
  if (source) {
    return {
      kind: "bySource",
      request: {
        sourceType: sourceTypeOf(source.kind),
        sourceId: source.id,
        limit: pageSize,
        offset,
      },
    }
  }
  const { after, before } = periodRange(filter, Math.floor(nowSeconds))
  return {
    kind: "list",
    request: {
      ...(filter.sourceType && { sourceType: sourceTypeOf(filter.sourceType) }),
      ...(filter.server && { jobworkerpServerId: { value: filter.server } }),
      ...(after !== undefined && { triggeredAfter: String(after) }),
      ...(before !== undefined && { triggeredBefore: String(before) }),
      limit: pageSize,
      offset,
    },
  }
}

/** The page's rows in the status; rows whose status is not known yet are left out. */
export function filterByStatus<T>(
  rows: readonly T[],
  status: StatusName | undefined,
  statusOf: (row: T) => ResolvedExecutionStatus | undefined,
): readonly T[] {
  if (!status) return rows
  const wanted = statusOfName(status)
  return rows.filter((row) => statusOf(row) === wanted)
}
