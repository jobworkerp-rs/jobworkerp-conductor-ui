import { useLanguage } from "@/hooks/use-language"
import { formatDateTime } from "@/lib/format"

/**
 * A UNIX-seconds value, in the browser's time zone unless one is given
 * (cron times are shown in conductor's cron zone, spec §4.2).
 */
export function DateTime({
  seconds,
  timeZone,
  withZone = false,
}: {
  seconds: string | number
  timeZone?: string
  withZone?: boolean
}) {
  const { language } = useLanguage()
  const value = Number(seconds)
  return (
    <time dateTime={new Date(value * 1000).toISOString()}>
      {formatDateTime(value, language, timeZone, { withZone })}
    </time>
  )
}
