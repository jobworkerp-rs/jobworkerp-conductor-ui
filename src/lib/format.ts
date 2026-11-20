import type { Language } from "./languages"

export const nowSeconds = () => Date.now() / 1000

/** Local date and time with seconds; timeZone defaults to the browser's (spec §4.2). */
export function formatDateTime(
  epochSeconds: number,
  language: Language,
  timeZone?: string,
  options: { withZone?: boolean } = {},
): string {
  return new Intl.DateTimeFormat(language, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
    timeZone,
    timeZoneName: options.withZone ? "short" : undefined,
  }).format(new Date(epochSeconds * 1000))
}

const RELATIVE_UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["second", 1],
  ["minute", 60],
  ["hour", 3600],
  ["day", 86400],
]

/** "2 minutes ago" / "in 3 days", using the largest unit that fits. */
export function formatRelative(
  epochSeconds: number,
  language: Language,
  now: number = nowSeconds(),
): string {
  const diff = epochSeconds - now
  let [unit, size] = RELATIVE_UNITS[0]
  for (const [candidate, candidateSize] of RELATIVE_UNITS) {
    if (Math.abs(diff) >= candidateSize) [unit, size] = [candidate, candidateSize]
  }
  return new Intl.RelativeTimeFormat(language, { numeric: "always" }).format(
    Math.round(diff / size),
    unit,
  )
}

export function formatNumber(value: number, language: Language): string {
  return new Intl.NumberFormat(language).format(value)
}

/** conductor stores timestamps as int64 UNIX seconds, which the generated code carries as strings. */
export function toEpochSeconds(seconds: number): string {
  return String(Math.floor(seconds))
}

const DURATION_UNITS: [Intl.NumberFormatOptions["unit"], number][] = [
  ["hour", 3_600_000],
  ["minute", 60_000],
  ["second", 1000],
]

/** A duration in the largest unit that fits, to one decimal; milliseconds below a second. */
export function formatDuration(ms: number, language: Language): string {
  const [unit, size] = DURATION_UNITS.find(([, unitMs]) => ms >= unitMs) ?? ["millisecond", 1]
  return new Intl.NumberFormat(language, {
    style: "unit",
    unit,
    maximumFractionDigits: size === 1 ? 0 : 1,
  }).format(ms / size)
}
