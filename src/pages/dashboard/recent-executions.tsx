import { useMemo } from "react"
import { useTranslation } from "react-i18next"
import { Link } from "react-router"
import { QueryError } from "@/components/common/query-error"
import { StatusCell } from "@/components/executions/execution-cells"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useExecutionPage, useRuntimeStatuses } from "@/hooks/use-executions"
import { useLanguage } from "@/hooks/use-language"
import { RECENT_CONSIDERED, pickRecentExecutions } from "@/lib/dashboard"
import { toListQuery } from "@/lib/executions/filter"
import { executionId, executionPath } from "@/lib/executions/source"
import { resolvedStatusOf } from "@/lib/executions/status"
import { formatRelative } from "@/lib/format"
import { navPath } from "@/lib/navigation"

/** Running or failed among the latest executions of the last day (spec §6.1). */
export function RecentExecutions({ now }: { now: number }) {
  const { t } = useTranslation()
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h3>{t("dashboard.recent.title")}</h3>
        </CardTitle>
        <CardDescription>
          {t("dashboard.recent.description", { count: RECENT_CONSIDERED })}
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 text-sm">
        <RecentList now={now} />
        <Link to={navPath("executions")} className="text-sm underline">
          {t("dashboard.recent.all")}
        </Link>
      </CardContent>
    </Card>
  )
}

function RecentList({ now }: { now: number }) {
  const { t } = useTranslation()
  const { language } = useLanguage()
  const query = useMemo(() => toListQuery({ period: "24h" }, now, 1, RECENT_CONSIDERED), [now])
  const list = useExecutionPage(query)
  const rows = useMemo(() => list.data?.rows ?? [], [list.data])
  const statuses = useRuntimeStatuses(useMemo(() => rows.map(executionId), [rows]))
  const picked = pickRecentExecutions(rows, (row) =>
    resolvedStatusOf(statuses.get(executionId(row))),
  )

  if (list.isError) return <QueryError error={list.error} onRetry={() => void list.refetch()} />
  if (list.isPending || (picked.pending && picked.rows.length === 0)) {
    return <p className="text-muted-foreground">{t("common.loading")}</p>
  }
  if (picked.rows.length === 0) {
    return <p className="text-muted-foreground">{t("dashboard.recent.none")}</p>
  }
  return (
    <ul className="divide-y">
      {picked.rows.map((row) => {
        const id = executionId(row)
        return (
          <li key={id} className="flex items-center justify-between gap-3 py-2">
            <div className="flex min-w-0 items-center gap-2">
              <StatusCell status={statuses.get(id)} />
              <Link to={executionPath(id)} className="truncate hover:underline">
                {row.sourceName}
              </Link>
            </div>
            <span className="text-muted-foreground shrink-0 text-xs">
              {formatRelative(Number(row.triggeredAt), language, now)}
            </span>
          </li>
        )
      })}
    </ul>
  )
}
