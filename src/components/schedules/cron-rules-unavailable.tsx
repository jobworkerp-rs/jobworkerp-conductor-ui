import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"

/** conductor's cron rules failed to load: what that stops, and a retry. */
export function CronRulesUnavailable({
  message,
  onRetry,
}: {
  message: string
  onRetry: () => void
}) {
  const { t } = useTranslation()
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <p className="text-destructive">{message}</p>
      <Button type="button" variant="outline" size="sm" onClick={onRetry}>
        {t("common.retry")}
      </Button>
    </div>
  )
}
