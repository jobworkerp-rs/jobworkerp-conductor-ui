import { useState } from "react"
import { useTranslation } from "react-i18next"
import { CheckboxField } from "@/components/common/checkbox-field"
import { ConfirmDialog } from "@/components/common/confirm-dialog"
import { useExecutionOperations } from "@/hooks/use-executions"
import { useNotify } from "@/hooks/use-notify"
import type { SourceKind } from "@/lib/executions/source"

/**
 * Deletes one source's execution history (spec §6.6). Unfinished executions
 * are kept unless included, which then also needs the source's name typed.
 */
export function DeleteBySourceDialog({
  kind,
  sourceId,
  name,
  onClose,
}: {
  kind: SourceKind
  sourceId: string
  name: string
  onClose: () => void
}) {
  const { t } = useTranslation()
  const operations = useExecutionOperations()
  const notify = useNotify()
  const [includeActive, setIncludeActive] = useState(false)
  return (
    <ConfirmDialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={t("executions.deleteBySource.title", { name })}
      description={t("executions.deleteBySource.description")}
      confirmLabel={t("common.delete")}
      destructive
      requiredText={includeActive ? name : undefined}
      onConfirm={async () => {
        const count = await operations.removeBySource(kind, sourceId, includeActive)
        notify.success(t("executions.deleteBySource.done", { count }))
      }}
    >
      <CheckboxField
        label={t("executions.deleteBySource.includeActive")}
        checked={includeActive}
        onChange={setIncludeActive}
      />
    </ConfirmDialog>
  )
}
