import { useTranslation } from "react-i18next"
import { useConnection } from "@/hooks/use-connection"
import { cn } from "@/lib/utils"

const DOT = {
  checking: "bg-muted-foreground",
  connected: "bg-green-500",
  disconnected: "bg-destructive",
} as const

/** Whether the conductor admin API answers, as a dot and a label. */
export function ConnectionIndicator() {
  const { t } = useTranslation()
  const { status } = useConnection()
  return (
    <span className="flex items-center gap-2">
      <span className={cn("inline-block h-2 w-2 rounded-full", DOT[status])} aria-hidden />
      {t(`connection.${status}`)}
    </span>
  )
}
