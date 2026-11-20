import { beforeAll, describe, expect, it } from "vitest"
import type { CronSchedulerData } from "@/lib/grpc/jobworkerp_conductor/data/cron_scheduler"
import type { ConfigEntity } from "@/lib/services/config"
import { loadTestRustCron } from "@/test/wasm"
import {
  filterSchedules,
  nextRunFinder,
  nextRunsOf,
  parseScheduleFilter,
  soonestRuns,
  summarizeSchedules,
  type NextRunState,
} from "./list"
import type { RustCron } from "./rust-cron"

let cron: RustCron
beforeAll(async () => {
  cron = await loadTestRustCron()
})

const NOW = Date.UTC(2026, 0, 1) / 1000
const HOUR = 3600

function schedule(id: string, data: Partial<CronSchedulerData> = {}): ConfigEntity<"schedules"> {
  return {
    id,
    data: {
      name: `s${id}`,
      jobworkerpServerId: { value: "1" },
      workflowUrl: "",
      crontab: "0 0 * * * *",
      enabled: true,
      createdAt: "0",
      updatedAt: "0",
      ...data,
    },
  }
}

describe("nextRunsOf", () => {
  it("gives enabled schedules their next run, or why there is none", () => {
    const runs = nextRunsOf(
      [
        schedule("1", { crontab: "0 0 3 * * *" }),
        schedule("2", { crontab: "0 0 3 * * *", enabled: false }),
        schedule("3", { crontab: "0 3 * * *" }),
        schedule("4", { crontab: "0 0 0 1 1 * 2020" }),
      ],
      nextRunFinder(cron),
      "UTC",
      NOW,
    )
    expect(runs).toEqual(
      new Map<string, NextRunState>([
        ["1", NOW + 3 * HOUR],
        ["3", "refused"],
        ["4", "noRun"],
      ]),
    )
  })

  it("computes in the given time zone", () => {
    const runs = nextRunsOf(
      [schedule("1", { crontab: "0 0 12 * * *" })],
      nextRunFinder(cron),
      "Asia/Tokyo",
      NOW,
    )
    expect(runs.get("1")).toBe(NOW + 3 * HOUR)
  })
})

describe("nextRunFinder", () => {
  it("keeps a run until it has passed, then finds the next one", () => {
    const find = nextRunFinder(cron)
    const first = find("0 0 * * * *", "UTC", NOW)
    expect(first).toBe(NOW + HOUR)
    expect(find("0 0 * * * *", "UTC", NOW + 60)).toBe(first)
    expect(find("0 0 * * * *", "UTC", NOW + HOUR)).toBe(NOW + 2 * HOUR)
  })

  it("tells time zones apart, and refused expressions from ones with no run", () => {
    const find = nextRunFinder(cron)
    expect(find("0 0 12 * * *", "UTC", NOW)).toBe(NOW + 12 * HOUR)
    expect(find("0 0 12 * * *", "Asia/Tokyo", NOW)).toBe(NOW + 3 * HOUR)
    expect(find("0 12 * * *", "UTC", NOW)).toBe("refused")
    expect(find("0 0 0 1 1 * 2020", "UTC", NOW)).toBe("noRun")
    expect(find("0 0 0 1 1 * 2020", "UTC", NOW + HOUR)).toBe("noRun")
  })
})

describe("summarizeSchedules", () => {
  it("counts enabled schedules and picks the soonest run of all", () => {
    const schedules = [schedule("1"), schedule("2", { enabled: false }), schedule("3")]
    const runs = new Map<string, NextRunState>([
      ["1", NOW + 2 * HOUR],
      ["3", NOW + HOUR],
      ["4", "refused"],
    ])
    expect(summarizeSchedules(schedules, runs)).toEqual({
      total: 3,
      enabled: 2,
      nextRun: { at: NOW + HOUR, name: "s3" },
    })
  })

  it("has no next run when nothing is scheduled", () => {
    expect(summarizeSchedules([schedule("1", { enabled: false })], new Map())).toEqual({
      total: 1,
      enabled: 0,
      nextRun: undefined,
    })
    expect(summarizeSchedules([], new Map())).toEqual({ total: 0, enabled: 0, nextRun: undefined })
  })
})

describe("parseScheduleFilter / filterSchedules", () => {
  const schedules = [
    schedule("1", { name: "nightly" }),
    schedule("2", { name: "hourly", enabled: false }),
    schedule("3", { name: "nightly-2", jobworkerpServerId: { value: "2" } }),
  ]
  const ids = (query: string) =>
    filterSchedules(schedules, parseScheduleFilter(new URLSearchParams(query))).map((s) => s.id)

  it("filters by name, status and server", () => {
    expect(ids("")).toEqual(["1", "2", "3"])
    expect(ids("q=NIGHT")).toEqual(["1", "3"])
    expect(ids("status=disabled")).toEqual(["2"])
    expect(ids("server=2")).toEqual(["3"])
    expect(ids("q=nightly&server=1")).toEqual(["1"])
  })
})

describe("soonestRuns", () => {
  it("lists the five soonest runs, leaving out schedules without one", () => {
    const schedules = ["a", "b", "c", "d", "e", "f", "g"].map((name, i) => ({
      id: String(i),
      data: { name },
    }))
    const runs = new Map<string, number | "refused" | "noRun">([
      ["0", 500],
      ["1", 100],
      ["2", "refused"],
      ["3", 300],
      ["4", 200],
      ["5", 400],
      ["6", 600],
    ])
    expect(soonestRuns(schedules, runs, 5)).toEqual([
      { id: "1", name: "b", at: 100 },
      { id: "4", name: "e", at: 200 },
      { id: "3", name: "d", at: 300 },
      { id: "5", name: "f", at: 400 },
      { id: "0", name: "a", at: 500 },
    ])
  })
})
