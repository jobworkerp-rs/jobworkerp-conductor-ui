import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { executionPath } from "@/lib/executions/source"
import { Link } from "react-router"
import { useNotify } from "@/hooks/use-notify"
import { executionStatusKey, type TriggerOutcome } from "@/lib/executions/status"

/**
 * Reports a run that conductor started (run now, re-run): accepted with its
 * status, or not enqueued with the reason, both linking to the execution.
 */
export function useTriggerNotice() {
  const { t } = useTranslation()
  const notify = useNotify()
  return (outcome: TriggerOutcome, name: string) => {
    // Following the link closes the toast; a failure one would stay until closed.
    let closeToast = () => {}
    const body = (detail: ReactNode) => (
      <span className="grid gap-1">
        {detail}
        {outcome.refId && (
          <Link
            className="underline"
            to={executionPath(outcome.refId)}
            onClick={() => closeToast()}
          >
            {t("executions.trigger.viewExecution")}
          </Link>
        )}
      </span>
    )
    if (outcome.accepted) {
      const status = t(executionStatusKey(outcome.status))
      closeToast = notify.success(
        t("executions.trigger.accepted", { name }),
        body(<span>{t("executions.trigger.acceptedStatus", { status })}</span>),
      )
    } else {
      closeToast = notify.failure(
        t("executions.trigger.enqueueFailed", { name }),
        body(outcome.error && <span>{outcome.error}</span>),
      )
    }
  }
}
