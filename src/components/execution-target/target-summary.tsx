import { useTranslation } from "react-i18next"
import { fromStoredTarget, type StoredTarget } from "@/lib/execution-target/form"
import { hasManagedWorkerName } from "@/lib/execution-target/managed-worker"

/**
 * One line naming what a setting runs, for list rows. Lists do not ask
 * jobworkerp, so a worker is shown as written here when its name says so.
 */
export function TargetSummary({ stored }: { stored: StoredTarget }) {
  const { t } = useTranslation()
  const target = fromStoredTarget({ serverId: "", stored })
  if (target.method === "workflowUrl") {
    return <>{t("settings.targetSummary.workflowUrl", { url: target.workflowUrl })}</>
  }
  return hasManagedWorkerName(target.workerName) ? (
    <>{t("settings.targetSummary.workflowInline", { name: target.workerName })}</>
  ) : (
    <>{t("settings.targetSummary.worker", { name: target.workerName })}</>
  )
}
