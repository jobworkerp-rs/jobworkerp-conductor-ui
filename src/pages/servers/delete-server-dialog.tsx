import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { ConfirmDialog } from "@/components/common/confirm-dialog"
import { useConfigSnapshot, useConfigActions } from "@/hooks/use-config"
import { useNotify } from "@/hooks/use-notify"
import {
  findServerReferences,
  groupReferencesByKind,
  type ServerReference,
} from "@/lib/servers/references"

const NAMES_SHOWN = 3

interface DeleteServerDialogProps {
  server: { id: string; name: string }
  /** The dialog is open while mounted; this is called when it closes. */
  onClose: () => void
  /** Called after the server is deleted and the user notified. */
  onDeleted?: () => void
}

/**
 * Deletes a server after warning about the configurations that use it.
 * conductor does not stop deleting a referenced server (spec §6.2), so the
 * references are refetched on opening: a reference added since they were
 * last loaded must not slip through.
 */
export function DeleteServerDialog({ server, onClose, onDeleted }: DeleteServerDialogProps) {
  const { t } = useTranslation()
  const notify = useNotify()
  const actions = useConfigActions("servers")
  const { data, refetch } = useConfigSnapshot()
  const [checked, setChecked] = useState(false)
  useEffect(() => {
    void refetch().then(() => setChecked(true))
  }, [refetch])

  return (
    <DeleteServerDialogView
      serverName={server.name}
      references={checked && data ? findServerReferences(server.id, data) : undefined}
      onClose={onClose}
      onConfirm={async () => {
        await actions.remove(server.id)
        notify.success(t("servers.delete.deleted"), server.name)
        onDeleted?.()
      }}
    />
  )
}

interface DeleteServerDialogViewProps {
  serverName: string
  /** Undefined while the current references are loading; confirming waits for them. */
  references: readonly ServerReference[] | undefined
  onClose: () => void
  onConfirm: () => Promise<void>
}

export function DeleteServerDialogView({
  serverName,
  references,
  onClose,
  onConfirm,
}: DeleteServerDialogViewProps) {
  const { t } = useTranslation()
  const count = references?.length ?? 0
  const description =
    references === undefined
      ? t("servers.delete.checking")
      : count > 0
        ? t("servers.delete.referencedDescription", { count })
        : t("servers.delete.description")
  return (
    <ConfirmDialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={t("servers.delete.title", { name: serverName })}
      description={description}
      confirmLabel={count > 0 ? t("servers.delete.confirmAnyway") : t("common.delete")}
      destructive
      confirmDisabled={references === undefined}
      onConfirm={onConfirm}
    >
      {count > 0 && (
        <ul className="border-destructive/50 bg-destructive/5 space-y-1 rounded-md border p-3 text-sm">
          {groupReferencesByKind(references!).map(({ kind, names }) => {
            const rest = names.length - NAMES_SHOWN
            return (
              <li key={kind}>
                {t(`references.kindGroups.${kind}`)}: {names.slice(0, NAMES_SHOWN).join(", ")}
                {rest > 0 && ` ${t("references.more", { count: rest })}`}
              </li>
            )
          })}
        </ul>
      )}
    </ConfirmDialog>
  )
}
