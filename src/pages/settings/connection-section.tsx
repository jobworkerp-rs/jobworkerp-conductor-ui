import { useTranslation } from "react-i18next"
import { ConnectionIndicator } from "@/components/layout/connection-indicator"
import { CronTimeZoneWarnings } from "@/components/schedules/cron-time-zone-warnings"
import { ReachabilityBadge } from "@/components/servers/reachability-badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useJobworkerpReachability } from "@/hooks/use-jobworkerp"
import { useRuntime } from "@/hooks/use-runtime"
import { useCronTimeZone, useRustCron } from "@/hooks/use-rust-cron"
import type { JobworkerpServerLink } from "@/lib/runtime-config"
import { SettingsSection } from "./settings-section"

/** Where this UI connects, read from the runtime config (spec §6.7). */
export function ConnectionSection() {
  const { t } = useTranslation()
  const { config } = useRuntime()
  const zone = useCronTimeZone(useRustCron())
  return (
    <SettingsSection
      title={t("settingsPage.connections.title")}
      description={t("settingsPage.connections.description")}
    >
      <dl className="grid gap-3 sm:grid-cols-[max-content_1fr] sm:gap-x-6">
        <dt className="text-muted-foreground">{t("settingsPage.connections.conductorUrl")}</dt>
        <dd className="space-y-1">
          <div className="font-mono break-all">{config.conductorUrl}</div>
          <ConnectionIndicator />
        </dd>
        <dt className="text-muted-foreground">{t("settingsPage.connections.cronTimeZone")}</dt>
        <dd className="space-y-1">
          <div className="font-mono">{zone.timeZone}</div>
          <CronTimeZoneWarnings zone={zone} />
        </dd>
      </dl>
      <h4 className="font-medium">{t("settingsPage.connections.servers")}</h4>
      {config.jobworkerpServers.length === 0 ? (
        <p className="text-muted-foreground">{t("settingsPage.connections.noServers")}</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("settingsPage.connections.columns.name")}</TableHead>
              <TableHead>{t("settingsPage.connections.columns.grpcWebUrl")}</TableHead>
              <TableHead>{t("settingsPage.connections.columns.adminUiUrl")}</TableHead>
              <TableHead>{t("settingsPage.connections.columns.reachability")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {config.jobworkerpServers.map((link) => (
              <ServerLinkRow key={link.name} link={link} />
            ))}
          </TableBody>
        </Table>
      )}
    </SettingsSection>
  )
}

function ServerLinkRow({ link }: { link: JobworkerpServerLink }) {
  const reachability = useJobworkerpReachability(link.name)
  return (
    <TableRow>
      <TableCell className="font-medium">{link.name}</TableCell>
      <TableCell className="font-mono break-all whitespace-normal">
        {link.grpcWebUrl ?? "—"}
      </TableCell>
      <TableCell className="font-mono break-all whitespace-normal">
        {link.adminUiUrl ?? "—"}
      </TableCell>
      <TableCell>
        <ReachabilityBadge reachability={reachability} />
      </TableCell>
    </TableRow>
  )
}
