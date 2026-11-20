import { Pencil, Trash2 } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Link, useNavigate, useParams } from "react-router"
import { DateTime } from "@/components/common/date-time"
import { DetailField } from "@/components/common/detail-field"
import { EnabledBadge } from "@/components/common/enabled-badge"
import { ExternalLinkButton } from "@/components/common/external-link-button"
import { QueryError } from "@/components/common/query-error"
import { QueryGate } from "@/components/common/query-gate"
import { PageHeader } from "@/components/layout/page-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useConfigSnapshot, useServer } from "@/hooks/use-config"
import { useJobworkerpInfo, useJobworkerpServer } from "@/hooks/use-jobworkerp"
import { useLanguage } from "@/hooks/use-language"
import { adminUiUrl } from "@/lib/admin-ui"
import { formatNumber } from "@/lib/format"
import type { JobworkerpServerData } from "@/lib/grpc/jobworkerp_conductor/data/jobworkerp_server"
import { serverEndpoint } from "@/lib/servers/form"
import { settingEditPath } from "@/lib/settings"
import { findServerReferences } from "@/lib/servers/references"
import { DeleteServerDialog } from "./delete-server-dialog"
import { JobworkerpStats } from "@/components/servers/jobworkerp-stats"
import { ReachabilityBadge } from "@/components/servers/reachability-badge"

function JobworkerpStatusCard({ name, adminUi }: { name: string; adminUi?: string }) {
  const { t } = useTranslation()
  const { language } = useLanguage()
  const { query, reachability } = useJobworkerpInfo(name)
  const info = query.data
  const links: ["workers" | "jobs" | "results", string][] = [
    ["workers", t("servers.detail.adminWorkers")],
    ["jobs", t("servers.detail.adminJobs")],
    ["results", t("servers.detail.adminResults")],
  ]
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div className="space-y-1.5">
          <CardTitle>{t("servers.detail.jobworkerpTitle")}</CardTitle>
          <CardDescription>{t("servers.detail.jobworkerpDescription")}</CardDescription>
        </div>
        <ReachabilityBadge reachability={reachability} />
      </CardHeader>
      <CardContent className="space-y-4">
        {reachability === "notConfigured" && (
          <p className="text-muted-foreground text-sm">{t("servers.detail.notConfigured")}</p>
        )}
        {query.isError && <QueryError error={query.error} onRetry={() => void query.refetch()} />}
        {info && (
          <>
            <JobworkerpStats info={info} />
            <div>
              <h4 className="text-muted-foreground mb-1 text-sm">{t("servers.detail.channels")}</h4>
              <ul className="divide-y text-sm">
                {info.channels.map((channel) => (
                  <li key={channel.name} className="flex justify-between py-1">
                    <span className="font-mono">
                      {channel.name || t("servers.detail.defaultChannel")}
                    </span>
                    <span>{formatNumber(channel.workerCount, language)}</span>
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}
        {adminUi && (
          <div className="flex flex-wrap gap-2">
            {links.map(([page, label]) => (
              <ExternalLinkButton key={page} href={adminUiUrl(adminUi, { page })} label={label} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export function ServerDetailPage() {
  const { t } = useTranslation()
  const { id } = useParams()
  const { query, server } = useServer(id)
  // Route changes run as a transition, so this page stays mounted until the
  // list renders; the refreshed list must not turn it into "not found" then.
  const [deleted, setDeleted] = useState(false)

  if (deleted) return null
  return (
    <QueryGate query={query} notFoundMessage={!server && t("servers.notFound", { id })}>
      {() => (
        <ServerDetail id={server!.id} data={server!.data} onDeleted={() => setDeleted(true)} />
      )}
    </QueryGate>
  )
}

function ServerDetail({
  id,
  data,
  onDeleted,
}: {
  id: string
  data: JobworkerpServerData
  onDeleted: () => void
}) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  // The references are this page's main content, so they follow auto refresh.
  const snapshot = useConfigSnapshot({ poll: true })
  const [deleting, setDeleting] = useState(false)
  const { link } = useJobworkerpServer(data.name)
  const references = snapshot.data ? findServerReferences(id, snapshot.data) : undefined

  return (
    <div className="space-y-6">
      <PageHeader
        title={data.name}
        description={data.description}
        actions={
          <>
            {link?.adminUiUrl && (
              <ExternalLinkButton
                href={adminUiUrl(link.adminUiUrl, { page: "dashboard" })}
                label={t("servers.detail.openAdminUi")}
              />
            )}
            <Button asChild variant="outline" size="sm">
              <Link to={`/servers/${id}/edit`}>
                <Pencil className="h-4 w-4" />
                {t("common.edit")}
              </Link>
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="text-destructive hover:text-destructive"
              onClick={() => setDeleting(true)}
            >
              <Trash2 className="h-4 w-4" />
              {t("common.delete")}
            </Button>
          </>
        }
      />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t("servers.detail.basic")}</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-[minmax(8rem,auto)_1fr] gap-x-4 gap-y-2 text-sm">
              <DetailField label={t("servers.detail.endpoint")}>
                <span className="font-mono">{serverEndpoint(data)}</span>
              </DetailField>
              <DetailField label={t("servers.detail.ssl")}>
                {data.sslEnabled ? t("servers.detail.sslOn") : t("servers.detail.sslOff")}
              </DetailField>
              <DetailField label={t("servers.detail.status")}>
                <EnabledBadge enabled={data.enabled} />
              </DetailField>
              <DetailField label={t("servers.detail.grpcWebUrl")}>
                <span className="font-mono">{link?.grpcWebUrl ?? t("common.notSet")}</span>
                <span className="text-muted-foreground block text-xs">
                  {t("servers.detail.fromRuntimeConfig")}
                </span>
              </DetailField>
              <DetailField label={t("servers.detail.adminUiUrl")}>
                <span className="font-mono">{link?.adminUiUrl ?? t("common.notSet")}</span>
                <span className="text-muted-foreground block text-xs">
                  {t("servers.detail.fromRuntimeConfig")}
                </span>
              </DetailField>
              <DetailField label={t("servers.detail.createdAt")}>
                <DateTime seconds={data.createdAt} />
              </DetailField>
              <DetailField label={t("servers.detail.updatedAt")}>
                <DateTime seconds={data.updatedAt} />
              </DetailField>
            </dl>
          </CardContent>
        </Card>
        <JobworkerpStatusCard name={data.name} adminUi={link?.adminUiUrl} />
      </div>
      <Card>
        <CardHeader>
          <CardTitle>{t("servers.detail.referencesTitle")}</CardTitle>
          <CardDescription>{t("servers.detail.referencesDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          {snapshot.isError && (
            <QueryError error={snapshot.error} onRetry={() => void snapshot.refetch()} />
          )}
          {references?.length === 0 && (
            <p className="text-muted-foreground text-sm">{t("servers.detail.referencesEmpty")}</p>
          )}
          {references && references.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("servers.detail.kind")}</TableHead>
                  <TableHead>{t("servers.columns.name")}</TableHead>
                  <TableHead>{t("servers.detail.role")}</TableHead>
                  <TableHead>{t("servers.columns.status")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {references.map((ref) => (
                  <TableRow key={`${ref.kind}-${ref.id}`}>
                    <TableCell>{t(`references.kind.${ref.kind}`)}</TableCell>
                    <TableCell>
                      <Link to={settingEditPath(ref.kind, ref.id)} className="hover:underline">
                        {ref.name}
                      </Link>
                    </TableCell>
                    <TableCell>
                      {ref.roles.map((role) => t(`references.roles.${role}`)).join(", ")}
                    </TableCell>
                    <TableCell>
                      <EnabledBadge enabled={ref.enabled} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      {deleting && (
        <DeleteServerDialog
          server={{ id, name: data.name }}
          onClose={() => setDeleting(false)}
          onDeleted={() => {
            onDeleted()
            navigate("/servers")
          }}
        />
      )}
    </div>
  )
}
