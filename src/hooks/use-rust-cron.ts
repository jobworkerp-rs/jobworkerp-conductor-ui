import { useMemo } from "react"
import {
  nextRunFinder,
  nextRunsOf,
  type CronRulesState,
  type NextRunState,
} from "@/lib/schedules/list"
import { loadRustCron } from "@/lib/schedules/load-rust-cron"
import { cronTimeZone, type CronTimeZone } from "@/lib/schedules/time-zone"
import type { ConfigEntity } from "@/lib/services/config"
import { useRuntime } from "./use-runtime"
import { useWasmModule } from "./use-wasm-module"

/**
 * conductor's cron rules in the browser (spec §6.3). Unlike the Slack regex
 * rules, nothing replaces them when they cannot be loaded: conductor does
 * not check expressions on save, so the form refuses to save until they
 * load, and `error` and `reload` let it say so and retry.
 */
export function useRustCron() {
  return useWasmModule("cron", loadRustCron)
}

/** The zone conductor runs schedules in, checked against its rules once they load. */
export function useCronTimeZone(cron: ReturnType<typeof useRustCron>): CronTimeZone {
  const { config } = useRuntime()
  const module = cron.module
  return useMemo(() => cronTimeZone(config, module?.knowsTimeZone), [config, module])
}

/**
 * The next run of each enabled schedule, in conductor's cron zone, once its
 * rules have loaded; with what the screen needs to say otherwise.
 */
export function useScheduleNextRuns(
  schedules: readonly ConfigEntity<"schedules">[],
  nowSeconds: number,
) {
  const cron = useRustCron()
  const zone = useCronTimeZone(cron)
  const module = cron.module
  const findNextRun = useMemo(() => module && nextRunFinder(module), [module])
  const nextRuns = useMemo(
    () =>
      findNextRun
        ? nextRunsOf(schedules, findNextRun, zone.timeZone, nowSeconds)
        : new Map<string, NextRunState>(),
    [schedules, findNextRun, zone.timeZone, nowSeconds],
  )
  const rules: CronRulesState = module ? "ready" : cron.error ? "failed" : "loading"
  return { nextRuns, zone, rules, reload: cron.reload }
}
