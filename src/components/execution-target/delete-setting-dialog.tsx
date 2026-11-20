import { useState } from "react"
import { useTranslation } from "react-i18next"
import { CheckboxField } from "@/components/common/checkbox-field"
import { ConfirmDialog } from "@/components/common/confirm-dialog"
import { useConfigActions } from "@/hooks/use-config"
import { useStoredTarget, useTargetActions } from "@/hooks/use-execution-target"
import { useNotify } from "@/hooks/use-notify"
import type { ConfigEntity } from "@/lib/services/config"
import { targetServerIdOf, type TargetSettingKind } from "@/lib/settings"

/**
 * Deletes a setting and, unless the user keeps it, the managed worker that
 * stores its workflow definition (spec §4.6.4).
 */
export function DeleteSettingDialog<K extends TargetSettingKind>({
  kind,
  setting,
  onClose,
  onDeleted,
}: {
  kind: K
  setting: ConfigEntity<K>
  onClose: () => void
  onDeleted?: () => void
}) {
  const { t } = useTranslation()
  const notify = useNotify()
  const config = useConfigActions(kind)
  const target = useTargetActions()
  const { ready, previous } = useStoredTarget(targetServerIdOf(kind, setting.data), setting.data)
  const [deleteWorker, setDeleteWorker] = useState(true)
  const name = setting.data.name

  return (
    <ConfirmDialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={t("settings.delete.title", { name })}
      description={t("settings.delete.description")}
      confirmLabel={t("common.delete")}
      destructive
      // Whether a managed worker comes along must be known before confirming.
      confirmDisabled={!ready}
      onConfirm={async () => {
        await target.remove({
          managed: previous,
          keepObsolete: !deleteWorker,
          remove: () => config.remove(setting.id),
        })
        notify.success(t("common.deleted"), name)
        onDeleted?.()
      }}
    >
      {previous && (
        <CheckboxField
          label={t("settings.delete.alsoDeleteWorker", { worker: previous.workerName })}
          checked={deleteWorker}
          onChange={setDeleteWorker}
        />
      )}
    </ConfirmDialog>
  )
}
