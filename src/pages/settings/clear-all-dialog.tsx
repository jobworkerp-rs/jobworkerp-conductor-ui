import { useState } from "react"
import { useTranslation } from "react-i18next"
import { CheckboxField } from "@/components/common/checkbox-field"
import { ConfirmDialog } from "@/components/common/confirm-dialog"
import { WarningText } from "@/components/common/warning-text"
import { useNotify } from "@/hooks/use-notify"
import { useClearAllSettings, type ManagedWorkers } from "@/hooks/use-settings-io"
import { uniqueWorkers } from "@/lib/settings-io"

const CONFIRM_TEXT = "DELETE"

/** Deletes every setting, and by default the managed workers they used (spec §6.7). */
export function ClearAllDialog({
  open,
  onOpenChange,
  inUse,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  inUse: ManagedWorkers
}) {
  const { t } = useTranslation()
  const notify = useNotify()
  const clearAll = useClearAllSettings()
  const [deleteWorkers, setDeleteWorkers] = useState(true)
  const workers = uniqueWorkers(inUse.managed)

  const clear = async () => {
    const { failedWorkers } = await clearAll(deleteWorkers ? workers : [])
    notify.success(t("settingsPage.clear.done"))
    if (failedWorkers.length > 0) {
      notify.failure(t("settingsPage.clear.workersFailed"), failedWorkers.join(", "))
    }
  }

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t("settingsPage.clear.dialogTitle")}
      description={t("settingsPage.clear.dialogDescription")}
      confirmLabel={t("settingsPage.clear.button")}
      destructive
      // The workers to offer for deletion are still being looked up.
      confirmDisabled={inUse.pending}
      requiredText={CONFIRM_TEXT}
      onConfirm={clear}
    >
      <p className="text-sm">{t("settingsPage.clear.historyKept")}</p>
      {workers.length > 0 && (
        <CheckboxField
          label={t("settingsPage.clear.deleteWorkers", { count: workers.length })}
          checked={deleteWorkers}
          onChange={setDeleteWorkers}
        />
      )}
      {inUse.unverified.length > 0 && (
        <WarningText className="text-sm">
          {t("settingsPage.clear.unverified", { count: inUse.unverified.length })}
        </WarningText>
      )}
    </ConfirmDialog>
  )
}
