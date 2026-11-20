import { AlertTriangle } from "lucide-react"
import { useTranslation } from "react-i18next"
import { ErrorDetails } from "@/components/common/error-details"
import { Button } from "@/components/ui/button"
import { useConnection } from "@/hooks/use-connection"
import { useRuntime } from "@/hooks/use-runtime"

/** Shown on every page while the conductor admin API cannot be reached (spec §4.4). */
export function ConnectionBanner() {
  const { t } = useTranslation()
  const { config } = useRuntime()
  const connection = useConnection()
  if (connection.status !== "disconnected") return null
  return (
    <div
      role="alert"
      className="border-destructive bg-destructive/5 flex gap-3 rounded-lg border p-4"
    >
      <AlertTriangle className="text-destructive mt-0.5 h-5 w-5 shrink-0" />
      <div className="min-w-0 flex-1 space-y-1">
        <p className="font-medium">{t("connection.bannerTitle")}</p>
        <p className="text-muted-foreground text-sm">
          {t("connection.bannerDescription", { url: config.conductorUrl })}
        </p>
        <p className="text-sm">{t(connection.error.messageKey, connection.error.messageValues)}</p>
        <ErrorDetails error={connection.error} />
      </div>
      <Button variant="outline" size="sm" onClick={connection.retry}>
        {t("common.retry")}
      </Button>
    </div>
  )
}
