import { useTranslation } from "react-i18next"
import { Link } from "react-router"
import { WarningText } from "@/components/common/warning-text"
import type { ManagedWorkers } from "@/hooks/use-settings-io"
import { targetKey, type WorkerTarget } from "@/lib/settings-io"
import { settingEditPath } from "@/lib/settings"

/**
 * The settings whose inline workflow definition lives in a jobworkerp
 * worker, so a TOML file keeps only the worker's name (spec §6.7).
 */
export function ManagedWorkflowNotice({ inUse }: { inUse: ManagedWorkers }) {
  const { t } = useTranslation()
  if (inUse.managed.length === 0 && inUse.unverified.length === 0) return null
  // Without a server, the worker could not be checked.
  const row = (target: WorkerTarget, server?: string) => (
    <li key={targetKey(target)} className="flex flex-wrap gap-x-2">
      <Link to={settingEditPath(target.kind, target.id)} className="underline">
        {target.name}
      </Link>
      <span className="text-muted-foreground">({t(`references.kind.${target.kind}`)})</span>
      <span>→</span>
      <code>{target.workerName}</code>
      <span className="text-muted-foreground">
        {server ? `@ ${server}` : t("settingsPage.export.unverified")}
      </span>
    </li>
  )
  return (
    <div role="note" className="space-y-2 rounded-md border p-3">
      <WarningText>{t("settingsPage.export.managedNotice")}</WarningText>
      <ul className="space-y-1">
        {inUse.managed.map((target) => row(target, target.serverName))}
        {inUse.unverified.map((target) => row(target))}
      </ul>
    </div>
  )
}
