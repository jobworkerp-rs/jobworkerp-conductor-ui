import { useTranslation } from "react-i18next"
import { Badge } from "@/components/ui/badge"

/** Enabled state as a labelled badge, not colour alone (spec §4.1). */
export function EnabledBadge({ enabled }: { enabled: boolean }) {
  const { t } = useTranslation()
  return (
    <Badge variant={enabled ? "default" : "secondary"}>
      {enabled ? t("common.enabled") : t("common.disabled")}
    </Badge>
  )
}
