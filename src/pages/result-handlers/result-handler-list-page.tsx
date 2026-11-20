import { Plus } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Link } from "react-router"
import { DataTable, type Column } from "@/components/common/data-table"
import { EnabledSwitch } from "@/components/common/enabled-switch"
import { ListScaleWarning } from "@/components/common/list-scale-warning"
import { NameCell } from "@/components/common/name-cell"
import { QueryError } from "@/components/common/query-error"
import { RowActions } from "@/components/common/row-actions"
import { DeleteSettingDialog } from "@/components/execution-target/delete-setting-dialog"
import { latestExecutionColumn } from "@/components/executions/latest-execution-column"
import { TargetSummary } from "@/components/execution-target/target-summary"
import { PageHeader } from "@/components/layout/page-header"
import { Button } from "@/components/ui/button"
import { useConfigActions, useConfigList, useServerName } from "@/hooks/use-config"
import { executionHistoryPath } from "@/lib/executions/source"
import type { ConfigEntity } from "@/lib/services/config"
import { settingEditPath } from "@/lib/settings"

type Handler = ConfigEntity<"resultHandlers">

const LIST_PATH = "/result-handlers"

export function ResultHandlerListPage() {
  const { t } = useTranslation()
  const handlers = useConfigList("resultHandlers")
  const serverName = useServerName()
  const actions = useConfigActions("resultHandlers")
  const [deleting, setDeleting] = useState<Handler | null>(null)

  const columns: Column<Handler>[] = [
    {
      id: "name",
      header: t("resultHandlers.columns.name"),
      className: "w-[28%] min-w-48 whitespace-normal break-all",
      cell: ({ id, data }) => (
        <NameCell
          name={data.name}
          to={settingEditPath("resultHandler", id)}
          description={data.description}
        >
          <div className="text-muted-foreground text-xs">
            <TargetSummary stored={data} />
          </div>
        </NameCell>
      ),
    },
    {
      id: "listen",
      header: t("resultHandlers.columns.listen"),
      className: "whitespace-normal",
      cell: ({ data }) => (
        <span className="text-sm">
          {serverName(data.listenJobworkerpServerId?.value)}
          {" / "}
          <span className="font-mono">{data.listenWorkerName}</span>
        </span>
      ),
    },
    {
      id: "process",
      header: t("resultHandlers.columns.process"),
      cell: ({ data }) => serverName(data.processJobworkerpServerId?.value),
    },
    {
      id: "status",
      header: t("resultHandlers.columns.status"),
      cell: ({ id, data }) => (
        <EnabledSwitch
          name={data.name}
          checked={data.enabled}
          onToggle={(next) => actions.setEnabled(id, next)}
        />
      ),
    },
    latestExecutionColumn("resultHandler"),
    {
      id: "actions",
      header: <span className="sr-only">{t("common.actions")}</span>,
      className: "w-[130px]",
      cell: (handler) => (
        <RowActions
          name={handler.data.name}
          editTo={settingEditPath("resultHandler", handler.id)}
          historyTo={executionHistoryPath("resultHandler", handler.id)}
          onDelete={() => setDeleting(handler)}
        />
      ),
    },
  ]

  const rows = handlers.data ?? []

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("pages.resultHandlers.title")}
        description={t("pages.resultHandlers.description")}
        actions={
          <Button asChild>
            <Link to={`${LIST_PATH}/new`}>
              <Plus className="h-4 w-4" />
              {t("common.create")}
            </Link>
          </Button>
        }
      />
      {handlers.isError ? (
        <QueryError error={handlers.error} onRetry={() => void handlers.refetch()} />
      ) : (
        <>
          <ListScaleWarning count={rows.length} />
          <DataTable
            columns={columns}
            rows={rows}
            getRowId={(h) => h.id}
            isLoading={handlers.isPending}
          />
        </>
      )}
      {deleting && (
        <DeleteSettingDialog
          kind="resultHandlers"
          setting={deleting}
          onClose={() => setDeleting(null)}
        />
      )}
    </div>
  )
}
