import { useTranslation } from "react-i18next"
import { WarningText } from "@/components/common/warning-text"
import type { CronTimeZone } from "@/lib/schedules/time-zone"

/** Why shown times may not be conductor's: no zone configured, or one conductor cannot read. */
export function CronTimeZoneWarnings({ zone }: { zone: CronTimeZone }) {
  const { t } = useTranslation()
  if (!zone.configured) return <WarningText>{t("schedules.cron.timeZoneUnset")}</WarningText>
  if (zone.rejected === undefined) return null
  return <WarningText>{t("schedules.cron.timeZoneRejected", { name: zone.rejected })}</WarningText>
}
