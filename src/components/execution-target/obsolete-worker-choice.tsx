import { useTranslation } from "react-i18next"
import { CheckboxField } from "@/components/common/checkbox-field"
import { useServerName } from "@/hooks/use-config"
import type { ManagedWorkerRef } from "@/lib/execution-target/cleanup"

/** "Delete the worker this save leaves unused", checked by default (spec §4.6.4). */
export function ObsoleteWorkerChoice({
  obsolete,
  checked,
  onChange,
}: {
  obsolete: ManagedWorkerRef
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  const { t } = useTranslation()
  const serverName = useServerName()
  return (
    <CheckboxField
      label={t("settings.deleteObsoleteWorker", {
        worker: obsolete.workerName,
        server: serverName(obsolete.serverId),
      })}
      checked={checked}
      onChange={onChange}
    />
  )
}
