import type { RuntimeConfig } from "@/lib/runtime-config"

export interface CronTimeZone {
  timeZone: string
  /** False when the runtime config does not say, and UTC is assumed. */
  configured: boolean
  /** The configured name conductor cannot read; it then runs schedules in UTC. */
  rejected?: string
}

const offsetName = (timeZone: string, date: Date) =>
  new Intl.DateTimeFormat("en", { timeZone, timeZoneName: "longOffset" })
    .formatToParts(date)
    .find((part) => part.type === "timeZoneName")?.value

/** Whether the zone's UTC offset changes during the year (either hemisphere). */
export function hasDaylightSaving(timeZone: string, year: number): boolean {
  return (
    offsetName(timeZone, new Date(Date.UTC(year, 0, 1))) !==
    offsetName(timeZone, new Date(Date.UTC(year, 6, 1)))
  )
}

/**
 * The zone conductor reads expressions in. The admin API does not tell, so
 * the runtime config mirrors CONDUCTOR_CRON_TIMEZONE (trimmed there, as
 * conductor trims it). Like conductor, use UTC when it is unset or when
 * chrono-tz does not know the name. `knowsTimeZone` comes with conductor's
 * rules; until they load, the name is taken as given.
 */
export function cronTimeZone(
  config: Pick<RuntimeConfig, "cronTimezone">,
  knowsTimeZone?: (name: string) => boolean,
): CronTimeZone {
  const name = config.cronTimezone
  if (!name) return { timeZone: "UTC", configured: false }
  if (knowsTimeZone && !knowsTimeZone(name)) {
    return { timeZone: "UTC", configured: true, rejected: name }
  }
  return { timeZone: name, configured: true }
}
