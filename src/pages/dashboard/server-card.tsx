import { useTranslation } from "react-i18next"
import { Link } from "react-router"
import { EnabledBadge } from "@/components/common/enabled-badge"
import { ExternalLinkButton } from "@/components/common/external-link-button"
import { JobworkerpStats } from "@/components/servers/jobworkerp-stats"
import { ReachabilityBadge } from "@/components/servers/reachability-badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useJobworkerpInfo, useJobworkerpServer } from "@/hooks/use-jobworkerp"
import { adminUiUrl } from "@/lib/admin-ui"
import type { JobworkerpServerData } from "@/lib/grpc/jobworkerp_conductor/data/jobworkerp_server"
import { serverDetailPath } from "@/lib/navigation"
import { serverEndpoint } from "@/lib/servers/form"
import {
  countReferencesByKind,
  findServerReferences,
  type ConfigSnapshot,
} from "@/lib/servers/references"

/** A registered server: conductor's view, and jobworkerp's own where linked (spec §6.1). */
export function ServerCard({
  id,
  data,
  snapshot,
}: {
  id: string
  data: JobworkerpServerData
  snapshot: ConfigSnapshot | undefined
}) {
  const { t } = useTranslation()
  const { link } = useJobworkerpServer(data.name)
  const { query, reachability } = useJobworkerpInfo(data.name)
  const counts = snapshot && countReferencesByKind(findServerReferences(id, snapshot))

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div className="min-w-0 space-y-1.5">
          <CardTitle className="flex items-center gap-2">
            <h4>
              <Link to={serverDetailPath(id)} className="hover:underline">
                {data.name}
              </Link>
            </h4>
            <EnabledBadge enabled={data.enabled} />
          </CardTitle>
          <CardDescription className="font-mono break-all">{serverEndpoint(data)}</CardDescription>
        </div>
        <ReachabilityBadge reachability={reachability} />
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {query.data && <JobworkerpStats info={query.data} />}
        <p className="text-muted-foreground">
          {counts ? t("dashboard.servers.references", counts) : t("common.loading")}
        </p>
        {link?.adminUiUrl && (
          <ExternalLinkButton
            href={adminUiUrl(link.adminUiUrl, { page: "dashboard" })}
            label={t("dashboard.servers.openAdminUi")}
          />
        )}
      </CardContent>
    </Card>
  )
}
