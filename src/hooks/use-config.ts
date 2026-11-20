import { useQueries, useQuery, useQueryClient, type UseQueryResult } from "@tanstack/react-query"
import { useMemo } from "react"
import { useTranslation } from "react-i18next"
import { useIdleRefetchInterval } from "@/hooks/use-auto-refresh"
import { useRuntime } from "@/hooks/use-runtime"
import { findEntity } from "@/lib/entities"
import { nowSeconds } from "@/lib/format"
import { STALE_MS } from "@/lib/refresh"
import type { ConfigSnapshot } from "@/lib/servers/references"
import {
  createConfig,
  deleteConfig,
  listConfig,
  setConfigEnabled,
  updateConfig,
  type ConfigDataByKind,
  type ConfigEntity,
  type ConfigEntityKind,
} from "@/lib/services/config"

export const configKey = (kind: ConfigEntityKind) => ["config", kind] as const

interface ListOptions {
  /**
   * Whether this observer polls. Only a page's own list should; lookups
   * derived from a list share its data without adding timers of their own.
   */
  poll?: boolean
  /** False leaves the list unfetched, for lookups that may not be needed. */
  enabled?: boolean
}

function useConfigListOptions<K extends ConfigEntityKind>(
  kind: K,
  { poll = true, enabled = true }: ListOptions = {},
) {
  const { conductor } = useRuntime()
  const interval = useIdleRefetchInterval()
  return {
    queryKey: configKey(kind),
    queryFn: ({ signal }: { signal: AbortSignal }) => listConfig(conductor, kind, signal),
    refetchInterval: poll ? interval : (false as const),
    staleTime: STALE_MS,
    enabled,
  }
}

/** All entries of one kind, read from the full list (conductor #84). */
export function useConfigList<K extends ConfigEntityKind>(kind: K, options?: ListOptions) {
  return useQuery(useConfigListOptions(kind, options))
}

export function useConfigEntity<K extends ConfigEntityKind>(
  kind: K,
  id: string | undefined,
  options?: ListOptions,
) {
  const query = useConfigList(kind, options)
  return { query, entity: query.data && findEntity(query.data, id) }
}

export const useServers = (options?: ListOptions) => useConfigList("servers", options)

export function useServer(id: string | undefined, options?: ListOptions) {
  const { query, entity } = useConfigEntity("servers", id, options)
  return { query, server: entity }
}

/** A server's display name by id; a deleted server is named as such. */
export function useServerName() {
  const { t } = useTranslation()
  const servers = useServers({ poll: false })
  return (id: string | undefined) =>
    (id !== undefined && servers.data && findEntity(servers.data, id)?.data.name) ||
    t("common.unknownServer", { id })
}

function combineSnapshot(
  results: [
    UseQueryResult<ConfigEntity<"schedules">[]>,
    UseQueryResult<ConfigEntity<"slackHandlers">[]>,
    UseQueryResult<ConfigEntity<"resultHandlers">[]>,
  ],
) {
  const [schedules, slackHandlers, resultHandlers] = results
  const failed = results.find((result) => result.isError)
  const data: ConfigSnapshot | undefined =
    schedules.data && slackHandlers.data && resultHandlers.data
      ? {
          schedules: schedules.data,
          slackHandlers: slackHandlers.data,
          resultHandlers: resultHandlers.data,
        }
      : undefined
  return {
    data,
    isError: failed !== undefined,
    error: failed?.error,
    refetch: () => Promise.all(results.map((result) => result.refetch())),
  }
}

/**
 * Schedules, Slack handlers and result handlers together, for reference
 * counting; it shares the lists' own queries rather than fetching them again.
 * Polling is off unless the references are what the caller shows, since they
 * are none of the page's own lists.
 */
export function useConfigSnapshot({ poll = false }: ListOptions = {}) {
  return useQueries({
    queries: [
      useConfigListOptions("schedules", { poll }),
      useConfigListOptions("slackHandlers", { poll }),
      useConfigListOptions("resultHandlers", { poll }),
    ],
    combine: combineSnapshot,
  })
}

/**
 * Create, update, toggle and delete one kind of entry. Only that kind's list
 * is refetched; a failure refetches too, since it may come from a row someone
 * else already changed or deleted, but the error is reported without waiting.
 */
export function useConfigActions<K extends ConfigEntityKind>(kind: K) {
  const { conductor } = useRuntime()
  const queryClient = useQueryClient()
  return useMemo(() => {
    const refresh = () => queryClient.invalidateQueries({ queryKey: configKey(kind) })
    const refreshAfter = async <T>(operation: Promise<T>): Promise<T> => {
      try {
        const result = await operation
        await refresh()
        return result
      } catch (err) {
        void refresh()
        throw err
      }
    }
    return {
      create: (data: ConfigDataByKind[K]) => refreshAfter(createConfig(conductor, kind, data)),
      update: (id: string, data: ConfigDataByKind[K]) =>
        refreshAfter(updateConfig(conductor, kind, id, data)),
      remove: (id: string) => refreshAfter(deleteConfig(conductor, kind, id)),
      setEnabled: (id: string, enabled: boolean) =>
        refreshAfter(setConfigEnabled(conductor, kind, id, enabled, nowSeconds())),
    }
  }, [conductor, queryClient, kind])
}
