import { useMemo } from "react"
import { useTranslation } from "react-i18next"
import { Link } from "react-router"
import { DateTime } from "@/components/common/date-time"
import { CronRulesUnavailable } from "@/components/schedules/cron-rules-unavailable"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useLanguage } from "@/hooks/use-language"
import { useScheduleNextRuns } from "@/hooks/use-rust-cron"
import { nextRunsView } from "@/lib/dashboard"
import { formatRelative } from "@/lib/format"
import type { ConfigSnapshot } from "@/lib/servers/references"
import { settingEditPath } from "@/lib/settings"

const NO_SCHEDULES: ConfigSnapshot["schedules"] = []

/** The soonest runs of the enabled schedules, in conductor's cron zone (spec §6.1). */
export function NextRuns({
  schedules,
  now,
}: {
  schedules: ConfigSnapshot["schedules"] | undefined
  now: number
}) {
  const { t } = useTranslation()
  const { nextRuns, zone, rules, reload } = useScheduleNextRuns(schedules ?? NO_SCHEDULES, now)
  const view = useMemo(() => nextRunsView(rules, schedules, nextRuns), [rules, schedules, nextRuns])

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h3>{t("dashboard.nextRuns.title")}</h3>
        </CardTitle>
        <CardDescription>
          {t("dashboard.nextRuns.description", { zone: zone.timeZone })}
        </CardDescription>
      </CardHeader>
      <CardContent className="text-sm">
        {view === "failed" ? (
          <CronRulesUnavailable message={t("schedules.nextRun.unavailable")} onRetry={reload} />
        ) : view === "loading" ? (
          <p className="text-muted-foreground">
            {rules === "loading" ? t("schedules.cron.loading") : t("common.loading")}
          </p>
        ) : (
          <RunList runs={view} timeZone={zone.timeZone} now={now} />
        )}
      </CardContent>
    </Card>
  )
}

function RunList({
  runs,
  timeZone,
  now,
}: {
  runs: { id: string; name: string; at: number }[]
  timeZone: string
  now: number
}) {
  const { t } = useTranslation()
  const { language } = useLanguage()
  if (runs.length === 0)
    return <p className="text-muted-foreground">{t("dashboard.nextRuns.none")}</p>
  return (
    <ul className="divide-y">
      {runs.map((run) => (
        <li key={run.id} className="flex items-center justify-between gap-3 py-2">
          <Link to={settingEditPath("schedule", run.id)} className="truncate hover:underline">
            {run.name}
          </Link>
          <span className="text-right">
            <DateTime seconds={run.at} timeZone={timeZone} withZone />
            <span className="text-muted-foreground block text-xs">
              {formatRelative(run.at, language, now)}
            </span>
          </span>
        </li>
      ))}
    </ul>
  )
}
