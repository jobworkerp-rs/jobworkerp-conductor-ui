import { AlertTriangle } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import { classifyError } from "@/lib/errors"
import { ErrorDetails } from "./error-details"

/** A failed load: what went wrong and a way to retry, never placeholder data (spec §4.4). */
export function QueryError({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const { t } = useTranslation()
  const classified = classifyError(error)
  return (
    <div
      role="alert"
      className="border-destructive bg-destructive/5 flex gap-3 rounded-lg border p-4"
    >
      <AlertTriangle className="text-destructive mt-0.5 h-5 w-5 shrink-0" />
      <div className="min-w-0 flex-1 space-y-1">
        <p className="font-medium">{t(classified.messageKey, classified.messageValues)}</p>
        <ErrorDetails error={classified} />
      </div>
      <Button variant="outline" size="sm" onClick={onRetry}>
        {t("common.retry")}
      </Button>
    </div>
  )
}
