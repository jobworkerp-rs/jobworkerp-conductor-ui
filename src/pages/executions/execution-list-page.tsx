import { Trash2 } from "lucide-react"
import { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { useSearchParams } from "react-router"
import { DataTable, type Column } from "@/components/common/data-table"
import { DateTime } from "@/components/common/date-time"
import { QueryError } from "@/components/common/query-error"
import { ExecutionActionsMenu } from "@/components/executions/execution-actions-menu"
import { DurationCell, SourceCell, StatusCell } from "@/components/executions/execution-cells"
import { PageHeader } from "@/components/layout/page-header"
import { Button } from "@/components/ui/button"
import { useServerName } from "@/hooks/use-config"
import { useExecutionPage, useRuntimeStatuses, useSourceName } from "@/hooks/use-executions"
import { useNow } from "@/hooks/use-now"
import { useUrlFilter } from "@/hooks/use-url-filter"
import {
  filterByStatus,
  parseExecutionFilter,
  singleSource,
  toListQuery,
} from "@/lib/executions/filter"
import type { ExecutionRef } from "@/lib/grpc/jobworkerp_conductor/data/execution_ref"
import { executionId } from "@/lib/executions/source"
import { DEFAULT_PAGE_SIZE, PAGE_PARAM, parsePageParam } from "@/lib/pagination"
import { DeleteBySourceDialog } from "./delete-by-source-dialog"
import { ExecutionFilters } from "./execution-filters"

// Relative periods ("last hour") move with time; recomputing each minute is
// enough, and keeps the query from changing on every render.
const CLOCK_MS = 60_000

export function ExecutionListPage() {
  const { t } = useTranslation()
  const [params] = useSearchParams()
  const [filter, , setFilters] = useUrlFilter(parseExecutionFilter)
  const page = parsePageParam(params.get(PAGE_PARAM))
  const now = useNow(CLOCK_MS)
  const serverName = useServerName()
  const [deletingHistory, setDeletingHistory] = useState(false)

  const query = useMemo(
    () => toListQuery(filter, now, page, DEFAULT_PAGE_SIZE),
    [filter, now, page],
  )
  const list = useExecutionPage(query)
  const rows = useMemo(() => list.data?.rows ?? [], [list.data])
  const statuses = useRuntimeStatuses(useMemo(() => rows.map(executionId), [rows]))
  const shown = filterByStatus(
    rows,
    filter.status,
    (row) => statuses.get(executionId(row))?.resolvedStatus,
  )

  const source = singleSource(filter)
  // The setting's name now, else the one recorded with its executions.
  const sourceName = useSourceName(source) ?? (source && rows[0]?.sourceName)

  const columns: Column<ExecutionRef>[] = [
    {
      id: "status",
      header: t("executions.columns.status"),
      cell: (row) => <StatusCell status={statuses.get(executionId(row))} />,
    },
    {
      id: "source",
      header: t("executions.columns.source"),
      className: "min-w-40 whitespace-normal break-all",
      cell: (row) => <SourceCell execution={row} />,
    },
    {
      id: "jobId",
      header: t("executions.columns.jobId"),
      cell: (row) => <code className="text-xs">{row.jobId ?? "—"}</code>,
    },
    {
      id: "server",
      header: t("executions.columns.server"),
      cell: (row) => serverName(row.jobworkerpServerId?.value),
    },
    {
      id: "triggeredAt",
      header: t("executions.columns.triggeredAt"),
      cell: (row) => <DateTime seconds={row.triggeredAt} />,
    },
    {
      id: "duration",
      header: t("executions.columns.duration"),
      cell: (row) => <DurationCell execution={row} status={statuses.get(executionId(row))} />,
    },
    {
      id: "actions",
      header: <span className="sr-only">{t("common.actions")}</span>,
      className: "w-12",
      cell: (row) => (
        <ExecutionActionsMenu
          execution={row}
          status={statuses.get(executionId(row))?.resolvedStatus}
        />
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("pages.executions.title")}
        description={t("pages.executions.description")}
        actions={
          source && (
            <Button variant="outline" onClick={() => setDeletingHistory(true)}>
              <Trash2 className="h-4 w-4" />
              {t("executions.deleteBySource.button")}
            </Button>
          )
        }
      />
      <ExecutionFilters filter={filter} sourceName={sourceName} onChange={setFilters} />
      {list.isError ? (
        <QueryError error={list.error} onRetry={() => void list.refetch()} />
      ) : (
        <DataTable
          columns={columns}
          rows={shown}
          getRowId={executionId}
          isLoading={list.isPending}
          serverPage={{
            page,
            hasNext: list.data?.hasNext ?? false,
            total: list.data?.total,
            size: rows.length,
          }}
        />
      )}
      {source && deletingHistory && (
        <DeleteBySourceDialog
          kind={source.kind}
          sourceId={source.id}
          name={sourceName ?? source.id}
          onClose={() => setDeletingHistory(false)}
        />
      )}
    </div>
  )
}
