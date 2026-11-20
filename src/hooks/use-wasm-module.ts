import { useQuery } from "@tanstack/react-query"

/**
 * A WebAssembly module loaded once per session. `module` is undefined while
 * loading or if the module cannot be loaded; `error` tells the two apart.
 */
export function useWasmModule<T>(name: string, load: () => Promise<T>) {
  const { data, error, refetch } = useQuery({
    queryKey: ["wasm", name],
    queryFn: load,
    staleTime: Number.POSITIVE_INFINITY,
    gcTime: Number.POSITIVE_INFINITY,
    retry: false,
  })
  const reload = () => {
    void refetch()
  }
  return { module: data, error: error ?? undefined, reload }
}
