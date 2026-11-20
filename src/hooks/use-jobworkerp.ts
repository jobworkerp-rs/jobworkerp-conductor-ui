import { useQueries, useQuery } from "@tanstack/react-query"
import { useIdleRefetchInterval } from "@/hooks/use-auto-refresh"
import { useRuntime } from "@/hooks/use-runtime"
import type { JobworkerpClients } from "@/lib/clients"
import { reachabilityOf, summarizeReachability } from "@/lib/reachability"
import { STALE_MS } from "@/lib/refresh"
import { fetchJobworkerpInfo, findJobResult, findWorkerByName } from "@/lib/services/jobworkerp"

/**
 * The browser-side link to a server registered in conductor: its runtime
 * configuration entry and clients, matched by name (spec §7.4).
 */
export function useJobworkerpServer(serverName: string) {
  const { config, jobworkerp } = useRuntime()
  return {
    link: config.jobworkerpServers.find((server) => server.name === serverName),
    clients: jobworkerp.get(serverName),
  }
}

// One cheap call tells whether a server's jobworkerp answers.
const reachabilityOptions = (
  serverName: string,
  clients: JobworkerpClients | undefined,
  refetchInterval: number | false,
) => ({
  queryKey: ["jobworkerp", serverName, "count"],
  queryFn: ({ signal }: { signal: AbortSignal }) => clients!.worker.count({}, { signal }),
  enabled: clients !== undefined,
  refetchInterval,
  staleTime: STALE_MS,
  retry: false,
})

/** Reachability alone; lists show it for every row. */
export function useJobworkerpReachability(serverName: string) {
  const { clients } = useJobworkerpServer(serverName)
  const query = useQuery(reachabilityOptions(serverName, clients, useIdleRefetchInterval()))
  return reachabilityOf({
    configured: clients !== undefined,
    pending: query.isPending,
    error: query.error,
  })
}

const infoOptions = (
  serverName: string,
  clients: JobworkerpClients | undefined,
  refetchInterval: number | false,
) => ({
  queryKey: ["jobworkerp", serverName, "info"],
  queryFn: ({ signal }: { signal: AbortSignal }) => fetchJobworkerpInfo(clients!, signal),
  enabled: clients !== undefined,
  refetchInterval,
  staleTime: STALE_MS,
  retry: false,
})

/** A worker by name, `null` when it does not exist; one cache entry per server and name. */
export const workerOptions = (
  serverName: string | undefined,
  clients: JobworkerpClients | undefined,
  name: string,
) => ({
  queryKey: ["jobworkerp", serverName, "worker", name],
  queryFn: async ({ signal }: { signal: AbortSignal }) =>
    (await findWorkerByName(clients!, name, signal)) ?? null,
  enabled: clients !== undefined && name !== "",
  staleTime: STALE_MS,
})

/** Worker and job figures of one server (spec §6.2). */
export function useJobworkerpInfo(serverName: string) {
  const { clients } = useJobworkerpServer(serverName)
  const query = useQuery(infoOptions(serverName, clients, useIdleRefetchInterval()))
  const reachability = reachabilityOf({
    configured: clients !== undefined,
    pending: query.isPending,
    error: query.error,
  })
  return { query, reachability }
}

/**
 * Of the servers with a browser link, how many answer (spec §6.1); judged
 * like each server card's badge, from the same figures those cards fetch.
 */
export function useReachabilitySummary(serverNames: readonly string[]) {
  const { jobworkerp } = useRuntime()
  const interval = useIdleRefetchInterval()
  const linked = serverNames.filter((name) => jobworkerp.has(name))
  return useQueries({
    queries: linked.map((name) => infoOptions(name, jobworkerp.get(name), interval)),
    combine: (results) =>
      summarizeReachability(
        results.map((result) =>
          reachabilityOf({ configured: true, pending: result.isPending, error: result.error }),
        ),
      ),
  })
}

/**
 * A job's stored result, through the server's browser link; fetched once
 * `ready` (it no longer changes once the job has finished).
 */
export function useJobResult(serverName: string, jobId: string | undefined, ready: boolean) {
  const { link, clients } = useJobworkerpServer(serverName)
  return {
    link,
    linked: clients !== undefined,
    query: useQuery({
      queryKey: ["jobworkerp", serverName, "jobResult", jobId],
      queryFn: async ({ signal }) => (await findJobResult(clients!, jobId!, { signal })) ?? null,
      enabled: clients !== undefined && jobId !== undefined && ready,
      staleTime: Number.POSITIVE_INFINITY,
      retry: false,
    }),
  }
}
