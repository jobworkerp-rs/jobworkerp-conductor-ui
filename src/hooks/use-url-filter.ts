import { useCallback, useMemo } from "react"
import { useSearchParams } from "react-router"
import { PAGE_PARAM } from "@/lib/pagination"

/**
 * A list filter kept in the URL query (spec §4.5). A change starts again
 * from the first page and replaces the history entry, so typing in a search
 * box does not leave a trail of back-button stops.
 */
export function useUrlFilter<F>(parse: (params: URLSearchParams) => F) {
  const [params, setParams] = useSearchParams()
  const filter = useMemo(() => parse(params), [parse, params])
  // Several keys in one navigation; separate calls would each start from
  // the same stale query and undo one another.
  const setFilters = useCallback(
    (patch: Record<string, string>) =>
      setParams(
        (previous) => {
          const next = new URLSearchParams(previous)
          for (const [key, value] of Object.entries(patch)) {
            if (value) next.set(key, value)
            else next.delete(key)
          }
          next.delete(PAGE_PARAM)
          return next
        },
        { replace: true },
      ),
    [setParams],
  )
  const setFilter = useCallback(
    (key: string, value: string) => setFilters({ [key]: value }),
    [setFilters],
  )
  return [filter, setFilter, setFilters] as const
}
