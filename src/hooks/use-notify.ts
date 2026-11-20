import { useMemo, type ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "@/hooks/use-toast"
import { classifyError } from "@/lib/errors"

const SUCCESS_TOAST_MS = 4_000

/** Success toasts disappear on their own; failures stay until dismissed (spec §4.4). */
export function useNotify() {
  const { t } = useTranslation()
  return useMemo(() => {
    // Each returns the toast's own dismiss, e.g. for a link inside it.
    const failure = (title: string, description?: ReactNode) =>
      toast({ variant: "destructive", title, description, duration: Number.POSITIVE_INFINITY })
        .dismiss
    return {
      success(title: string, description?: ReactNode) {
        return toast({ title, description, duration: SUCCESS_TOAST_MS }).dismiss
      },
      /** A failure the server reported as data rather than as an error. */
      failure,
      error(err: unknown, title?: string) {
        const error = classifyError(err)
        if (error.kind === "aborted") return
        failure(title ?? t(error.messageKey, error.messageValues), error.serverMessage)
      },
    }
  }, [t])
}
