import { Plus } from "lucide-react"
import { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { Link } from "react-router"
import { DataTable, type Column } from "@/components/common/data-table"
import { EnabledSwitch } from "@/components/common/enabled-switch"
import { NameStatusFilters } from "@/components/common/list-filters"
import { ListScaleWarning } from "@/components/common/list-scale-warning"
import { NameCell } from "@/components/common/name-cell"
import { NativeSelect } from "@/components/common/native-select"
import { QueryError } from "@/components/common/query-error"
import { RowActions } from "@/components/common/row-actions"
import { DeleteSettingDialog } from "@/components/execution-target/delete-setting-dialog"
import { latestExecutionColumn } from "@/components/executions/latest-execution-column"
import { TargetSummary } from "@/components/execution-target/target-summary"
import { PageHeader } from "@/components/layout/page-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useConfigActions, useConfigList, useServerName } from "@/hooks/use-config"
import { useUrlFilter } from "@/hooks/use-url-filter"
import { executionHistoryPath } from "@/lib/executions/source"
import type { ConfigEntity } from "@/lib/services/config"
import { settingEditPath } from "@/lib/settings"
import { eventKindOf } from "@/lib/slack/form"
import {
  channelsOf,
  filterSlackHandlers,
  parseSlackFilter,
  summarizeSlackHandlers,
} from "@/lib/slack/list"
import { ConditionsSummary } from "./conditions-summary"

type Handler = ConfigEntity<"slackHandlers">

const LIST_PATH = "/slack-handlers"

export function SlackHandlerListPage() {
  const { t } = useTranslation()
  const handlers = useConfigList("slackHandlers")
  const actions = useConfigActions("slackHandlers")
  const serverName = useServerName()
  const [filter, setFilter] = useUrlFilter(parseSlackFilter)
  const [deleting, setDeleting] = useState<Handler | null>(null)

  const all = useMemo(() => handlers.data ?? [], [handlers.data])
  const rows = useMemo(() => filterSlackHandlers(all, filter), [all, filter])
  const summary = useMemo(() => summarizeSlackHandlers(all), [all])
  const channels = useMemo(() => channelsOf(all), [all])

  const columns: Column<Handler>[] = [
    {
      id: "name",
      header: t("slackHandlers.columns.name"),
      className: "w-[26%] min-w-48 whitespace-normal break-all",
      cell: ({ id, data }) => (
        <NameCell
          name={data.name}
          to={settingEditPath("slackHandler", id)}
          description={data.description}
        >
          <div className="text-muted-foreground text-xs">
            <TargetSummary stored={data} />
          </div>
        </NameCell>
      ),
    },
    {
      id: "kind",
      header: t("slackHandlers.columns.kind"),
      cell: ({ data }) => (
        <Badge variant="secondary">{t(`slackHandlers.kinds.${eventKindOf(data)}`)}</Badge>
      ),
    },
    {
      id: "conditions",
      header: t("slackHandlers.columns.conditions"),
      className: "min-w-56 whitespace-normal break-all",
      cell: ({ data }) => <ConditionsSummary data={data} />,
    },
    {
      id: "server",
      header: t("slackHandlers.columns.server"),
      cell: ({ data }) => serverName(data.jobworkerpServerId?.value),
    },
    {
      id: "status",
      header: t("slackHandlers.columns.status"),
      cell: ({ id, data }) => (
        <EnabledSwitch
          name={data.name}
          checked={data.enabled}
          onToggle={(next) => actions.setEnabled(id, next)}
        />
      ),
    },
    latestExecutionColumn("slackHandler"),
    {
      id: "actions",
      header: <span className="sr-only">{t("common.actions")}</span>,
      className: "w-[130px]",
      cell: (handler) => (
        <RowActions
          name={handler.data.name}
          editTo={settingEditPath("slackHandler", handler.id)}
          historyTo={executionHistoryPath("slackHandler", handler.id)}
          onDelete={() => setDeleting(handler)}
        />
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("pages.slackHandlers.title")}
        description={t("pages.slackHandlers.description")}
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
          {handlers.data && (
            <p className="text-muted-foreground text-sm">
              {t("slackHandlers.summary", { ...summary })}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <NameStatusFilters filter={filter} onChange={setFilter} />
            <NativeSelect
              className="w-40"
              aria-label={t("slackHandlers.filters.kind")}
              value={filter.kind ?? ""}
              onChange={(e) => setFilter("kind", e.target.value)}
            >
              <option value="">{t("slackHandlers.filters.allKinds")}</option>
              <option value="message">{t("slackHandlers.kinds.message")}</option>
              <option value="reaction">{t("slackHandlers.kinds.reaction")}</option>
            </NativeSelect>
            <NativeSelect
              className="w-44"
              aria-label={t("slackHandlers.filters.channel")}
              value={filter.channel ?? ""}
              onChange={(e) => setFilter("channel", e.target.value)}
            >
              <option value="">{t("slackHandlers.filters.allChannels")}</option>
              {channels.map((channel) => (
                <option key={channel} value={channel}>
                  {channel}
                </option>
              ))}
            </NativeSelect>
          </div>
          <ListScaleWarning count={all.length} />
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
          kind="slackHandlers"
          setting={deleting}
          onClose={() => setDeleting(null)}
        />
      )}
    </div>
  )
}
