import {
  keepPreviousData,
  useQueries,
  useQuery,
  useQueryClient,
  type Query,
  type QueryKey,
  type UseQueryResult,
} from "@tanstack/react-query"
import { useCallback, useMemo } from "react"
import { useIdleRefetchInterval, usePolling } from "@/hooks/use-auto-refresh"
import { useConfigList, useServerName } from "@/hooks/use-config"
import { useJobResult } from "@/hooks/use-jobworkerp"
import { useRuntime } from "@/hooks/use-runtime"
import type { ConductorClients } from "@/lib/clients"
import { findEntity } from "@/lib/entities"
import type { ListQuery } from "@/lib/executions/filter"
import type { SourceKind } from "@/lib/executions/source"
import { isTerminalStatus, statusRefetchInterval } from "@/lib/executions/status"
import type {
  ExecutionRef,
  ExecutionRuntimeStatus,
} from "@/lib/grpc/jobworkerp_conductor/data/execution_ref"
import { STALE_MS, type Polling } from "@/lib/refresh"
import {
  cancelExecution,
  deleteExecution,
  deleteExecutionsBySource,
  findLatestStatusBySource,
  findRuntimeStatus,
  listExecutions,
  reExecute,
  triggerSchedule,
} from "@/lib/services/executions"
import { SETTING_ENTITY } from "@/lib/settings"

const EXECUTIONS_KEY = ["executions"] as const
const LIST_KEY = [...EXECUTIONS_KEY, "list"] as const
const LATEST_KEY = [...EXECUTIONS_KEY, "latest"] as const
const statusKey = (id: string | undefined) => [...EXECUTIONS_KEY, "status", id] as const

/** One page of the execution list, kept on screen while the next one loads. */
export function useExecutionPage(query: ListQuery) {
  const { conductor } = useRuntime()
  return useQuery({
    queryKey: [...LIST_KEY, query],
    queryFn: ({ signal }) => listExecutions(conductor, query, { signal }),
    refetchInterval: useIdleRefetchInterval(),
    staleTime: STALE_MS,
    placeholderData: keepPreviousData,
  })
}

// Statuses are fetched per execution (conductor has no batch form), each
// polled at the pace its own state calls for.
function statusQueryOptions(
  queryKey: QueryKey,
  fetch: (signal: AbortSignal) => Promise<ExecutionRuntimeStatus | undefined>,
  polling: Polling & { pollFinished?: boolean },
) {
  return {
    queryKey,
    // null: conductor has no such execution (a query cannot hold undefined).
    queryFn: async ({ signal }: { signal: AbortSignal }) => (await fetch(signal)) ?? null,
    refetchInterval: (query: Query<ExecutionRuntimeStatus | null>) =>
      statusRefetchInterval({ ...polling, status: query.state.data?.resolvedStatus }),
    // A finished execution's status no longer changes, so revisits reuse it.
    staleTime: (query: Query<ExecutionRuntimeStatus | null>) => {
      const status = query.state.data?.resolvedStatus
      return status !== undefined && isTerminalStatus(status) && !polling.pollFinished
        ? Number.POSITIVE_INFINITY
        : STALE_MS
    },
  }
}

const runtimeStatusOptions = (conductor: ConductorClients, id: string, polling: Polling) =>
  statusQueryOptions(
    statusKey(id),
    (signal) => findRuntimeStatus(conductor, id, { signal }),
    polling,
  )

/** One execution's status, with the execution itself (null when it does not exist). */
export function useRuntimeStatus(id: string | undefined) {
  const { conductor } = useRuntime()
  const polling = usePolling()
  return useQuery({ ...runtimeStatusOptions(conductor, id ?? "", polling), enabled: !!id })
}

/**
 * The statuses of the executions on a page, by id; each shares its
 * execution's own query. Undefined while loading, null for one gone.
 */
export function useRuntimeStatuses(ids: readonly string[]) {
  const { conductor } = useRuntime()
  const polling = usePolling()
  const combine = useCallback(
    (results: UseQueryResult<ExecutionRuntimeStatus | null>[]) =>
      new Map(ids.map((id, i) => [id, results[i]?.data] as const)),
    [ids],
  )
  return useQueries({
    queries: ids.map((id) => runtimeStatusOptions(conductor, id, polling)),
    combine,
  })
}

/**
 * The status of a setting's latest execution, for the lists' "latest" column.
 * It keeps polling once that run has finished, as a newer one replaces it.
 */
export function useLatestExecution(kind: SourceKind, sourceId: string) {
  const { conductor } = useRuntime()
  const polling = usePolling()
  return useQuery(
    statusQueryOptions(
      [...LATEST_KEY, kind, sourceId],
      (signal) => findLatestStatusBySource(conductor, kind, sourceId, { signal }),
      { ...polling, pollFinished: true },
    ),
  )
}

/** The current name of the setting behind an execution list, if one is chosen. */
export function useSourceName(source: { kind: SourceKind; id: string } | undefined) {
  const settings = useConfigList(SETTING_ENTITY[source?.kind ?? "schedule"], {
    poll: false,
    enabled: source !== undefined,
  })
  return source && findEntity(settings.data ?? [], source.id)?.data.name
}

/**
 * jobworkerp's stored result of a finished execution's job, through the
 * browser link of the server it ran on.
 */
export function useExecutionJobResult(
  execution: ExecutionRef,
  status: ExecutionRuntimeStatus | null | undefined,
) {
  const serverName = useServerName()(execution.jobworkerpServerId?.value)
  const finished = status != null && isTerminalStatus(status.resolvedStatus)
  return { ...useJobResult(serverName, execution.jobId, finished), finished }
}

/**
 * Run now, cancel, re-run and delete. Afterwards the lists and the latest
 * runs are refetched, and the execution operated on; other executions'
 * statuses keep their own pace.
 */
export function useExecutionOperations() {
  const { conductor } = useRuntime()
  const queryClient = useQueryClient()
  return useMemo(() => {
    const after = async <T>(operation: Promise<T>, ...touched: string[]): Promise<T> => {
      try {
        return await operation
      } finally {
        for (const queryKey of [LIST_KEY, LATEST_KEY, ...touched.map(statusKey)]) {
          void queryClient.invalidateQueries({ queryKey })
        }
      }
    }
    return {
      triggerSchedule: (scheduleId: string, argsJson?: string) =>
        after(triggerSchedule(conductor, scheduleId, argsJson)),
      cancel: (id: string) => after(cancelExecution(conductor, id), id),
      reExecute: (id: string) => after(reExecute(conductor, id), id),
      remove: (id: string) => after(deleteExecution(conductor, id), id),
      removeBySource: (kind: SourceKind, sourceId: string, includeActive: boolean) =>
        after(deleteExecutionsBySource(conductor, kind, sourceId, includeActive)),
    }
  }, [conductor, queryClient])
}
