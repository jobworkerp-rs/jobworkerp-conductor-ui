import { Lock, Plus } from "lucide-react"
import { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { Link } from "react-router"
import { DataTable, type Column } from "@/components/common/data-table"
import { DateTime } from "@/components/common/date-time"
import { EnabledSwitch } from "@/components/common/enabled-switch"
import { ListScaleWarning } from "@/components/common/list-scale-warning"
import { NameCell } from "@/components/common/name-cell"
import { QueryError } from "@/components/common/query-error"
import { RowActions } from "@/components/common/row-actions"
import { PageHeader } from "@/components/layout/page-header"
import { Button } from "@/components/ui/button"
import { useConfigSnapshot, useConfigActions, useServers } from "@/hooks/use-config"
import { useJobworkerpReachability } from "@/hooks/use-jobworkerp"
import type { Entity } from "@/lib/entities"
import type { JobworkerpServerData } from "@/lib/grpc/jobworkerp_conductor/data/jobworkerp_server"
import { serverEndpoint } from "@/lib/servers/form"
import { countReferencesByServer } from "@/lib/servers/references"
import { serverDetailPath } from "@/lib/navigation"
import { DeleteServerDialog } from "./delete-server-dialog"
import { ReachabilityBadge } from "@/components/servers/reachability-badge"

type Server = Entity<JobworkerpServerData>

function ServerReachability({ name }: { name: string }) {
  return <ReachabilityBadge reachability={useJobworkerpReachability(name)} />
}

export function ServerListPage() {
  const { t } = useTranslation()
  const servers = useServers()
  const snapshot = useConfigSnapshot()
  const counts = useMemo(
    () => (snapshot.data ? countReferencesByServer(snapshot.data) : undefined),
    [snapshot.data],
  )
  const actions = useConfigActions("servers")
  const [deleting, setDeleting] = useState<Server | null>(null)

  const columns: Column<Server>[] = [
    {
      id: "name",
      header: t("servers.columns.name"),
      // Cells do not wrap by default; long names and hosts must not push
      // the action buttons out of view.
      className: "w-[22%] min-w-40 whitespace-normal break-all",
      cell: ({ id, data }) => (
        <NameCell name={data.name} to={serverDetailPath(id)} description={data.description} />
      ),
    },
    {
      id: "endpoint",
      header: t("servers.columns.endpoint"),
      className: "min-w-48 whitespace-normal break-all",
      cell: ({ data }) => (
        <span className="inline-flex items-center gap-1 font-mono text-sm">
          {data.sslEnabled && (
            <Lock className="h-3 w-3" aria-label={t("servers.sslTitle")} role="img" />
          )}
          {serverEndpoint(data)}
        </span>
      ),
    },
    {
      id: "status",
      header: t("servers.columns.status"),
      cell: ({ id, data }) => (
        <EnabledSwitch
          name={data.name}
          checked={data.enabled}
          onToggle={(next) => actions.setEnabled(id, next)}
        />
      ),
    },
    {
      id: "reachability",
      header: t("servers.columns.reachability"),
      cell: ({ data }) => <ServerReachability name={data.name} />,
    },
    {
      id: "references",
      header: t("servers.columns.references"),
      cell: ({ id }) => (counts ? (counts.get(id) ?? 0) : ""),
    },
    {
      id: "updatedAt",
      header: t("servers.columns.updatedAt"),
      className: "text-muted-foreground",
      cell: ({ data }) => <DateTime seconds={data.updatedAt} />,
    },
    {
      id: "actions",
      header: <span className="sr-only">{t("common.actions")}</span>,
      className: "w-[90px]",
      cell: (server) => (
        <RowActions
          name={server.data.name}
          editTo={`${serverDetailPath(server.id)}/edit`}
          onDelete={() => setDeleting(server)}
        />
      ),
    },
  ]

  const rows = servers.data ?? []

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("pages.servers.title")}
        description={t("pages.servers.description")}
        actions={
          <Button asChild>
            <Link to="/servers/new">
              <Plus className="h-4 w-4" />
              {t("common.create")}
            </Link>
          </Button>
        }
      />
      {servers.isError ? (
        <QueryError error={servers.error} onRetry={() => void servers.refetch()} />
      ) : (
        <>
          <ListScaleWarning count={rows.length} />
          <DataTable
            columns={columns}
            rows={rows}
            getRowId={(s) => s.id}
            isLoading={servers.isPending}
          />
        </>
      )}
      {snapshot.isError && (
        <QueryError error={snapshot.error} onRetry={() => void snapshot.refetch()} />
      )}
      {deleting && (
        <DeleteServerDialog
          server={{ id: deleting.id, name: deleting.data.name }}
          onClose={() => setDeleting(null)}
        />
      )}
    </div>
  )
}
