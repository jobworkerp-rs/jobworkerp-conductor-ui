import {
  countEnabled,
  matchesNameStatus,
  parseNameStatusFilter,
  type NameStatusFilter,
} from "@/lib/list-filter"
import type { ConfigEntity } from "@/lib/services/config"
import type { RustCron } from "./rust-cron"

type Schedule = ConfigEntity<"schedules">

/** Whether conductor's cron rules (the WebAssembly module) are usable yet. */
export type CronRulesState = "loading" | "failed" | "ready"

/**
 * When a schedule runs next (UNIX seconds), or why it does not: conductor
 * cannot schedule the expression, or no run is found (e.g. a past year).
 */
export type NextRunState = number | "refused" | "noRun"

export type NextRunFinder = (
  expression: string,
  timeZone: string,
  nowSeconds: number,
) => NextRunState

/**
 * The next run of an expression, remembered until it has passed. An
 * expression that never fires makes croner search for tens of milliseconds,
 * so lists that recompute as time goes by ask again only when needed.
 */
export function nextRunFinder(cron: RustCron): NextRunFinder {
  const known = new Map<string, NextRunState>()
  return (expression, timeZone, nowSeconds) => {
    const key = `${timeZone} ${expression}`
    const cached = known.get(key)
    if (cached !== undefined && (typeof cached !== "number" || cached > nowSeconds)) return cached
    const found = cron.nextRuns(expression, timeZone, nowSeconds, 1)
    // Only a failure needs telling apart: a refused expression, or no run.
    const next: NextRunState =
      "runs" in found
        ? (found.runs[0] ?? "noRun")
        : cron.check(expression) === undefined
          ? "noRun"
          : "refused"
    known.set(key, next)
    return next
  }
}

/** The next run of each enabled schedule, by id; disabled schedules have no entry. */
export function nextRunsOf(
  schedules: readonly Schedule[],
  findNextRun: NextRunFinder,
  timeZone: string,
  nowSeconds: number,
): Map<string, NextRunState> {
  const runs = new Map<string, NextRunState>()
  for (const { id, data } of schedules) {
    if (data.enabled) runs.set(id, findNextRun(data.crontab, timeZone, nowSeconds))
  }
  return runs
}

export interface ScheduleSummary {
  total: number
  enabled: number
  /** The soonest run of all schedules (spec §6.3), not the first row's. */
  nextRun?: { at: number; name: string }
}

/** The soonest next runs, across schedules that have one. */
export function soonestRuns(
  schedules: readonly { id: string; data: { name: string } }[],
  nextRuns: ReadonlyMap<string, NextRunState>,
  count: number,
): { id: string; name: string; at: number }[] {
  return schedules
    .flatMap(({ id, data }) => {
      const at = nextRuns.get(id)
      return typeof at === "number" ? [{ id, name: data.name, at }] : []
    })
    .sort((a, b) => a.at - b.at)
    .slice(0, count)
}

export function summarizeSchedules(
  schedules: readonly Schedule[],
  nextRuns: ReadonlyMap<string, NextRunState>,
): ScheduleSummary {
  const [nextRun] = soonestRuns(schedules, nextRuns, 1)
  return { ...countEnabled(schedules), nextRun: nextRun && { at: nextRun.at, name: nextRun.name } }
}

/** The common filters plus the server the schedule runs on. */
export interface ScheduleFilter extends NameStatusFilter {
  server?: string
}

export function parseScheduleFilter(params: URLSearchParams): ScheduleFilter {
  const filter: ScheduleFilter = parseNameStatusFilter(params)
  const server = params.get("server")
  if (server) filter.server = server
  return filter
}

export function filterSchedules(
  schedules: readonly Schedule[],
  filter: ScheduleFilter,
): Schedule[] {
  return schedules.filter(
    ({ data }) =>
      matchesNameStatus(data, filter) &&
      (!filter.server || data.jobworkerpServerId?.value === filter.server),
  )
}
