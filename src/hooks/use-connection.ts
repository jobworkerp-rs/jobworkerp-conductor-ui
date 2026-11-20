import { useQuery } from "@tanstack/react-query"
import { useRuntime } from "@/hooks/use-runtime"
import { classifyError, type ClassifiedError } from "@/lib/errors"
import { IDLE_REFRESH_MS } from "@/lib/refresh"

export type ConnectionState =
  | { status: "checking" }
  | { status: "connected" }
  | { status: "disconnected"; error: ClassifiedError; retry: () => void }

/**
 * Probes the conductor admin API with a cheap RPC. Only failures to get a
 * gRPC reply count as disconnected; a gRPC error status still proves the
 * endpoint is reachable.
 */
export function useConnection(): ConnectionState {
  const { conductor } = useRuntime()
  const query = useQuery({
    queryKey: ["connection"],
    queryFn: ({ signal }) => conductor.jobworkerpServer.count({}, { signal }),
    refetchInterval: IDLE_REFRESH_MS,
    // Several components watch the connection; a fresh result is shared
    // instead of re-probing whenever one of them mounts.
    staleTime: IDLE_REFRESH_MS,
    retry: false,
  })
  if (query.isPending && query.fetchStatus !== "idle") return { status: "checking" }
  if (query.isError) {
    const error = classifyError(query.error)
    if (error.kind === "network" || error.kind === "http") {
      return { status: "disconnected", error, retry: () => void query.refetch() }
    }
  }
  return { status: "connected" }
}
