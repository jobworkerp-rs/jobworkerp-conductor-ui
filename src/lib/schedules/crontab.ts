export interface NormalizedCrontab {
  expression: string
  /** A five-field expression got conductor's required seconds field (spec §6.3). */
  secondsAdded: boolean
}

/** What is saved for an input: fields joined by single spaces, seconds added to five fields. */
export function normalizeCrontab(input: string): NormalizedCrontab {
  const fields = input.trim().split(/\s+/)
  const secondsAdded = fields.length === 5 && !fields[0].startsWith("@")
  return { expression: (secondsAdded ? ["0", ...fields] : fields).join(" "), secondsAdded }
}

/**
 * Whether both the day of month and the day of week are given, so a run
 * needs both to match (conductor parses with croner's dom_and_dow, unlike
 * the usual cron which needs either). Mirrors croner: "?" is "*", aliases
 * leave one of them "*", and a leading "+" only forces the same rule.
 */
export function restrictsBothDays(expression: string): boolean {
  const fields = expression.trim().toUpperCase().split(/\s+/)
  if (fields.length < 6 || fields[0].startsWith("@")) return false
  const wildcard = (field: string) => field.replaceAll("?", "*").replace(/^\+/, "") === "*"
  return !wildcard(fields[3]) && !wildcard(fields[5])
}

export const CRON_PRESETS = [
  { key: "everyMinute", expression: "0 * * * * *" },
  { key: "hourly", expression: "0 0 * * * *" },
  { key: "daily", expression: "0 0 9 * * *" },
  { key: "weekdays", expression: "0 0 9 * * MON-FRI" },
  { key: "weekly", expression: "0 0 9 * * MON" },
  { key: "monthly", expression: "0 0 0 1 * *" },
] as const
