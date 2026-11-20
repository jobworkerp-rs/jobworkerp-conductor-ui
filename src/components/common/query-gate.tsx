import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { QueryError } from "./query-error"

interface QueryState {
  isPending: boolean
  isError: boolean
  error: unknown
  refetch: () => unknown
}

/**
 * Loading, the error with a retry, or a "not found" message; otherwise the
 * content. Pages read single entries from full lists (conductor #84), so an
 * entry can be missing even when the list loaded.
 */
export function QueryGate({
  query,
  pending = false,
  notFoundMessage,
  children,
}: {
  query: QueryState
  /** More loading the page waits for, beyond the query itself. */
  pending?: boolean
  /** Shown instead of the content when set, once the query has data. */
  notFoundMessage?: string | false
  children: () => ReactNode
}) {
  const { t } = useTranslation()
  if (query.isError) return <QueryError error={query.error} onRetry={() => void query.refetch()} />
  if (query.isPending || pending)
    return <p className="text-muted-foreground">{t("common.loading")}</p>
  if (notFoundMessage) return <p role="alert">{notFoundMessage}</p>
  return children()
}
