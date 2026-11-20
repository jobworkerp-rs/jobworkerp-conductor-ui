import { useTranslation } from "react-i18next"
import { QueryError } from "@/components/common/query-error"
import { PageHeader } from "@/components/layout/page-header"
import { useConfigSnapshot, useServers } from "@/hooks/use-config"
import { useNow } from "@/hooks/use-now"
import { NextRuns } from "./next-runs"
import { RecentExecutions } from "./recent-executions"
import { ServerCard } from "./server-card"
import { SummaryCards } from "./summary-cards"

// Relative times and "last 24 hours" move with the clock.
const CLOCK_MS = 60_000

/** `/` (spec §6.1). */
export function DashboardPage() {
  const { t } = useTranslation()
  // These lists are the page's content, so they follow auto refresh.
  const snapshot = useConfigSnapshot({ poll: true })
  const servers = useServers()
  const now = useNow(CLOCK_MS)

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("pages.dashboard.title")}
        description={t("pages.dashboard.description")}
      />
      {snapshot.isError || servers.isError ? (
        <QueryError
          error={snapshot.error ?? servers.error}
          onRetry={() => {
            void snapshot.refetch()
            void servers.refetch()
          }}
        />
      ) : (
        <>
          <SummaryCards snapshot={snapshot.data} servers={servers.data} />
          <div className="grid gap-6 lg:grid-cols-2">
            <RecentExecutions now={now} />
            <NextRuns schedules={snapshot.data?.schedules} now={now} />
          </div>
          <section className="space-y-3" aria-labelledby="dashboard-servers">
            <h3 id="dashboard-servers" className="text-lg font-semibold">
              {t("dashboard.servers.title")}
            </h3>
            {servers.data?.length === 0 && (
              <p className="text-muted-foreground text-sm">{t("dashboard.servers.none")}</p>
            )}
            <div className="grid gap-4 lg:grid-cols-2">
              {servers.data?.map((server) => (
                <ServerCard
                  key={server.id}
                  id={server.id}
                  data={server.data}
                  snapshot={snapshot.data}
                />
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  )
}
