import { useTranslation } from "react-i18next"
import { Link } from "react-router"
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useReachabilitySummary } from "@/hooks/use-jobworkerp"
import { countEnabled } from "@/lib/list-filter"
import { navPath } from "@/lib/navigation"
import { TARGET_SETTING_KINDS } from "@/lib/settings"
import type { ConfigSnapshot } from "@/lib/servers/references"
import type { JobworkerpServerData } from "@/lib/grpc/jobworkerp_conductor/data/jobworkerp_server"

function SummaryCard({
  to,
  title,
  value,
  detail,
}: {
  to: string
  title: string
  value: string
  detail?: string
}) {
  return (
    <Link
      to={to}
      className="focus-visible:ring-ring rounded-xl focus-visible:ring-2 focus-visible:outline-none"
    >
      <Card className="hover:bg-accent/50 h-full transition-colors">
        <CardHeader>
          <CardDescription>{title}</CardDescription>
          <CardTitle className="text-2xl">{value}</CardTitle>
          {detail && <p className="text-sm">{detail}</p>}
        </CardHeader>
      </Card>
    </Link>
  )
}

/** Enabled out of all per kind of setting, each leading to its screen (spec §6.1). */
export function SummaryCards({
  snapshot,
  servers,
}: {
  snapshot: ConfigSnapshot | undefined
  servers: readonly { data: JobworkerpServerData }[] | undefined
}) {
  const { t } = useTranslation()
  const reach = useReachabilitySummary((servers ?? []).map((s) => s.data.name))
  const reachDetail = (summary: typeof reach) => {
    if (summary === "none") return undefined
    if (summary === "checking") return t("servers.reach.checking")
    return t("dashboard.cards.reachable", summary)
  }
  const enabled = (entries: readonly { data: { enabled: boolean } }[] | undefined) =>
    entries ? t("dashboard.cards.enabled", countEnabled(entries)) : t("common.loading")
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {TARGET_SETTING_KINDS.map((kind) => (
        <SummaryCard
          key={kind}
          to={navPath(kind)}
          title={t(`dashboard.cards.${kind}`)}
          value={enabled(snapshot?.[kind])}
        />
      ))}
      <SummaryCard
        to={navPath("servers")}
        title={t("dashboard.cards.servers")}
        value={enabled(servers)}
        detail={reachDetail(reach)}
      />
    </div>
  )
}
