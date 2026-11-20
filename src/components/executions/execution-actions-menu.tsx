import { MoreHorizontal } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Link } from "react-router"
import { ConfirmDialog } from "@/components/common/confirm-dialog"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useExecutionOperations } from "@/hooks/use-executions"
import { useNotify } from "@/hooks/use-notify"
import { executionActions, type Availability } from "@/lib/executions/actions"
import { executionPath, sourceKindOf } from "@/lib/executions/source"
import { settingEditPath } from "@/lib/settings"
import {
  ResolvedExecutionStatus,
  type ExecutionRef,
} from "@/lib/grpc/jobworkerp_conductor/data/execution_ref"
import { useTriggerNotice } from "@/hooks/use-trigger-notice"

const OPERATIONS = ["cancel", "reExecute", "delete"] as const
type Pending = (typeof OPERATIONS)[number] | null

/**
 * The operations on one execution (spec §6.6). Those not possible in its
 * status stay listed, disabled, with the reason.
 */
export function ExecutionActionsMenu({
  execution,
  status,
  showDetails = true,
  onDeleted,
}: {
  execution: ExecutionRef
  /** Undefined while the status loads: only what does not depend on it is offered. */
  status: ResolvedExecutionStatus | undefined
  showDetails?: boolean
  onDeleted?: () => void
}) {
  const { t } = useTranslation()
  const operations = useExecutionOperations()
  const notify = useNotify()
  const notice = useTriggerNotice()
  const [pending, setPending] = useState<Pending>(null)
  const id = execution.id?.value ?? ""
  const kind = sourceKindOf(execution.sourceType)
  const actions = executionActions(
    status ?? ResolvedExecutionStatus.RESOLVED_EXECUTION_STATUS_UNSPECIFIED,
    execution,
  )
  const close = (open: boolean) => !open && setPending(null)

  const item = (action: Exclude<Pending, null>, availability: Availability) => (
    <DropdownMenuItem
      key={action}
      disabled={!availability.allowed}
      onSelect={() => setPending(action)}
      className="flex-col items-start gap-0"
    >
      <span>{t(`executions.actions.${action}`)}</span>
      {!availability.allowed && (
        <span className="text-muted-foreground text-xs">{t(availability.reason)}</span>
      )}
    </DropdownMenuItem>
  )

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label={t("executions.actions.menu", { id })}>
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="max-w-72">
          {showDetails && (
            <DropdownMenuItem asChild>
              <Link to={executionPath(id)}>{t("executions.actions.details")}</Link>
            </DropdownMenuItem>
          )}
          {kind && (
            <DropdownMenuItem asChild>
              <Link to={settingEditPath(kind, execution.sourceId)}>
                {t("executions.actions.openSetting")}
              </Link>
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          {OPERATIONS.map((operation) => item(operation, actions[operation]))}
        </DropdownMenuContent>
      </DropdownMenu>

      <ConfirmDialog
        open={pending === "cancel"}
        onOpenChange={close}
        title={t("executions.cancel.title", { id })}
        description={t("executions.cancel.description", { jobId: execution.jobId })}
        confirmLabel={t("executions.cancel.confirm")}
        destructive
        onConfirm={async () => {
          if (await operations.cancel(id)) notify.success(t("executions.cancel.done"))
          else notify.failure(t("executions.cancel.nothing"))
        }}
      />
      <ConfirmDialog
        open={pending === "reExecute"}
        onOpenChange={close}
        title={t("executions.reExecute.title", { name: execution.sourceName })}
        description={t("executions.reExecute.description")}
        confirmLabel={t("executions.reExecute.confirm")}
        onConfirm={async () => notice(await operations.reExecute(id), execution.sourceName)}
      />
      <ConfirmDialog
        open={pending === "delete"}
        onOpenChange={close}
        title={t("executions.delete.title", { id })}
        description={t("executions.delete.description")}
        confirmLabel={t("common.delete")}
        destructive
        onConfirm={async () => {
          const deleted = await operations.remove(id)
          notify.success(deleted ? t("common.deleted") : t("executions.delete.alreadyGone"))
          onDeleted?.()
        }}
      />
    </>
  )
}
