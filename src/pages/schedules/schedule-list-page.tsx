import { Play, Plus } from "lucide-react"
import { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { Link } from "react-router"
import { DataTable, type Column } from "@/components/common/data-table"
import { DateTime } from "@/components/common/date-time"
import { EnabledSwitch } from "@/components/common/enabled-switch"
import { NameStatusFilters } from "@/components/common/list-filters"
import { ListScaleWarning } from "@/components/common/list-scale-warning"
import { NameCell } from "@/components/common/name-cell"
import { NativeSelect } from "@/components/common/native-select"
import { QueryError } from "@/components/common/query-error"
import { RowActions } from "@/components/common/row-actions"
import { WARNING_TEXT_CLASS } from "@/components/common/warning-text"
import { DeleteSettingDialog } from "@/components/execution-target/delete-setting-dialog"
import { latestExecutionColumn } from "@/components/executions/latest-execution-column"
import { TargetSummary } from "@/components/execution-target/target-summary"
import { PageHeader } from "@/components/layout/page-header"
import { Button } from "@/components/ui/button"
import { useConfigActions, useConfigList, useServerName, useServers } from "@/hooks/use-config"
import { useLanguage } from "@/hooks/use-language"
import { useNow } from "@/hooks/use-now"
import { useScheduleNextRuns } from "@/hooks/use-rust-cron"
import { useUrlFilter } from "@/hooks/use-url-filter"
import { formatDateTime } from "@/lib/format"
import { describeCrontab } from "@/lib/schedules/describe"
import {
  filterSchedules,
  parseScheduleFilter,
  summarizeSchedules,
  type CronRulesState,
  type NextRunState,
} from "@/lib/schedules/list"
import { executionHistoryPath } from "@/lib/executions/source"
import type { ConfigEntity } from "@/lib/services/config"
import { settingEditPath } from "@/lib/settings"
import { CronRulesUnavailable } from "@/components/schedules/cron-rules-unavailable"
import { CronTimeZoneWarnings } from "@/components/schedules/cron-time-zone-warnings"
import { RunScheduleDialog } from "./run-schedule-dialog"

type Schedule = ConfigEntity<"schedules">

const LIST_PATH = "/schedules"
// Next runs move on with time even when the list itself does not change.
const CLOCK_MS = 30_000

export function ScheduleListPage() {
  const { t } = useTranslation()
  const { language } = useLanguage()
  const schedules = useConfigList("schedules")
  const actions = useConfigActions("schedules")
  const servers = useServers({ poll: false })
  const serverName = useServerName()
  const now = useNow(CLOCK_MS)
  const [filter, setFilter] = useUrlFilter(parseScheduleFilter)
  const [running, setRunning] = useState<Schedule | null>(null)
  const [deleting, setDeleting] = useState<Schedule | null>(null)

  const all = useMemo(() => schedules.data ?? [], [schedules.data])
  const rows = useMemo(() => filterSchedules(all, filter), [all, filter])
  const { nextRuns, zone, rules, reload } = useScheduleNextRuns(all, now)
  const timeZone = zone.timeZone
  const summary = useMemo(() => summarizeSchedules(all, nextRuns), [all, nextRuns])
  const nextRunText = (() => {
    if (rules !== "ready") return rules === "loading" ? t("schedules.cron.loading") : undefined
    if (!summary.nextRun) return t("schedules.noNextRun")
    return t("schedules.nextRunSummary", {
      time: formatDateTime(summary.nextRun.at, language, timeZone, { withZone: true }),
      name: summary.nextRun.name,
    })
  })()
  const descriptions = useMemo(
    () => new Map(all.map(({ id, data }) => [id, describeCrontab(data.crontab, language)])),
    [all, language],
  )

  const columns: Column<Schedule>[] = [
    {
      id: "name",
      header: t("schedules.columns.name"),
      className: "w-[26%] min-w-48 whitespace-normal break-all",
      cell: ({ id, data }) => (
        <NameCell
          name={data.name}
          to={settingEditPath("schedule", id)}
          description={data.description}
        >
          <div className="text-muted-foreground text-xs">
            <TargetSummary stored={data} />
          </div>
        </NameCell>
      ),
    },
    {
      id: "crontab",
      header: t("schedules.columns.crontab"),
      className: "min-w-48 whitespace-normal",
      cell: ({ id, data }) => (
        <div>
          <code className="text-sm break-all">{data.crontab}</code>
          <div className="text-muted-foreground text-xs">{descriptions.get(id)}</div>
        </div>
      ),
    },
    {
      id: "nextRun",
      header: t("schedules.columns.nextRun"),
      className: "whitespace-normal",
      cell: ({ id, data }) =>
        data.enabled ? (
          <NextRunCell rules={rules} next={nextRuns.get(id)} timeZone={timeZone} />
        ) : (
          "—"
        ),
    },
    {
      id: "server",
      header: t("schedules.columns.server"),
      cell: ({ data }) => serverName(data.jobworkerpServerId?.value),
    },
    {
      id: "status",
      header: t("schedules.columns.status"),
      cell: ({ id, data }) => (
        <EnabledSwitch
          name={data.name}
          checked={data.enabled}
          onToggle={(next) => actions.setEnabled(id, next)}
        />
      ),
    },
    latestExecutionColumn("schedule"),
    {
      id: "actions",
      header: <span className="sr-only">{t("common.actions")}</span>,
      className: "w-[170px]",
      cell: (schedule) => (
        <div className="flex justify-end gap-1">
          <Button
            variant="ghost"
            size="icon"
            aria-label={t("schedules.runNow", { name: schedule.data.name })}
            onClick={() => setRunning(schedule)}
          >
            <Play className="h-4 w-4" />
          </Button>
          <RowActions
            name={schedule.data.name}
            editTo={settingEditPath("schedule", schedule.id)}
            historyTo={executionHistoryPath("schedule", schedule.id)}
            onDelete={() => setDeleting(schedule)}
          />
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("pages.schedules.title")}
        description={t("pages.schedules.description")}
        actions={
          <Button asChild>
            <Link to={`${LIST_PATH}/new`}>
              <Plus className="h-4 w-4" />
              {t("common.create")}
            </Link>
          </Button>
        }
      />
      {schedules.isError ? (
        <QueryError error={schedules.error} onRetry={() => void schedules.refetch()} />
      ) : (
        <>
          {schedules.data && (
            <div className="text-muted-foreground space-y-1 text-sm">
              <p>
                {t("schedules.summary", { ...summary })}
                {nextRunText && ` · ${nextRunText}`}
              </p>
              <p>{t("schedules.timeZoneNote", { zone: timeZone })}</p>
              <CronTimeZoneWarnings zone={zone} />
            </div>
          )}
          {rules === "failed" && (
            <CronRulesUnavailable message={t("schedules.nextRun.unavailable")} onRetry={reload} />
          )}
          <div className="flex flex-wrap items-center gap-2">
            <NameStatusFilters filter={filter} onChange={setFilter} />
            <NativeSelect
              className="w-44"
              aria-label={t("schedules.filters.server")}
              value={filter.server ?? ""}
              onChange={(e) => setFilter("server", e.target.value)}
            >
              <option value="">{t("schedules.filters.allServers")}</option>
              {(servers.data ?? []).map((server) => (
                <option key={server.id} value={server.id}>
                  {server.data.name}
                </option>
              ))}
            </NativeSelect>
          </div>
          <ListScaleWarning count={all.length} />
          <DataTable
            columns={columns}
            rows={rows}
            getRowId={(s) => s.id}
            isLoading={schedules.isPending}
          />
        </>
      )}
      {running && <RunScheduleDialog schedule={running} onClose={() => setRunning(null)} />}
      {deleting && (
        <DeleteSettingDialog
          kind="schedules"
          setting={deleting}
          onClose={() => setDeleting(null)}
        />
      )}
    </div>
  )
}

/** An enabled schedule's next run, or why it has none. */
function NextRunCell({
  rules,
  next,
  timeZone,
}: {
  rules: CronRulesState
  next: NextRunState | undefined
  timeZone: string
}) {
  const { t } = useTranslation()
  if (rules === "loading")
    return <span className="text-muted-foreground">{t("common.loading")}</span>
  if (rules === "failed" || next === undefined) return t("schedules.nextRun.unknown")
  if (next === "refused")
    return <span className="text-destructive">{t("schedules.nextRun.refused")}</span>
  if (next === "noRun")
    return <span className={WARNING_TEXT_CLASS}>{t("schedules.nextRun.noRun")}</span>
  return <DateTime seconds={next} timeZone={timeZone} withZone />
}
