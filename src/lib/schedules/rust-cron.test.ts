import { beforeAll, describe, expect, it } from "vitest"
import { loadTestRustCron } from "@/test/wasm"
import type { RustCron } from "./rust-cron"

let cron: RustCron
beforeAll(async () => {
  cron = await loadTestRustCron()
})

const at = (...parts: [number, number, number, number?, number?]) =>
  Date.UTC(parts[0], parts[1] - 1, parts[2], parts[3] ?? 0, parts[4] ?? 0) / 1000
const NEW_YEAR_2026 = at(2026, 1, 1)
const DAY = 86_400

describe("RustCron.check", () => {
  it("accepts conductor's syntax: seconds required, optional year, names and specials", () => {
    for (const expression of [
      "0 0 9 * * MON-FRI",
      "0 0 9 * * mon-fri",
      "0 0 0 1 1 * 2030",
      "0 */15 * * * *",
      "0 0 9-17/2 * JAN-MAR *",
      "0 0 12 ? * SUN",
      "0 0 0 L * *",
      "0 0 0 15W * *",
      "0 0 0 * * 5#3",
      "0 0 0 * * 5L",
      "  0 0 9 * * *  ",
    ]) {
      expect(cron.check(expression), expression).toBeUndefined()
    }
  })

  it("accepts the six aliases croner knows", () => {
    for (const alias of ["@yearly", "@annually", "@monthly", "@weekly", "@daily", "@hourly"]) {
      expect(cron.check(alias), alias).toBeUndefined()
    }
  })

  it("refuses field counts other than six or seven, five included", () => {
    for (const expression of ["* * * *", "0 9 * * *", "0 0 0 * * * * *"]) {
      expect(cron.check(expression), expression).toMatch(/6 or 7 fields/)
    }
  })

  it("refuses the aliases croner does not know", () => {
    for (const alias of ["@midnight", "@reboot"]) {
      expect(cron.check(alias), alias).toMatch(/.+/)
    }
  })

  it("refuses out-of-range values and illegal characters", () => {
    for (const expression of [
      "60 * * * * *",
      "0 60 * * * *",
      "0 0 24 * * *",
      "0 0 0 32 * *",
      "0 0 0 0 * *",
      "0 0 0 * 13 *",
      "0 0 0 * * 8",
      "0 0 0 * * MON$",
    ]) {
      expect(cron.check(expression), expression).toMatch(/.+/)
    }
  })

  it("refuses an empty expression", () => {
    expect(cron.check("")).toMatch(/empty/)
    expect(cron.check("   ")).toMatch(/empty/)
  })
})

describe("RustCron.nextRuns", () => {
  it("lists the runs after a time, in UTC", () => {
    expect(cron.nextRuns("0 0 9 * * *", "UTC", NEW_YEAR_2026, 5)).toEqual({
      runs: [0, 1, 2, 3, 4].map((day) => at(2026, 1, 1, 9) + day * DAY),
    })
  })

  it("interprets the expression in the given time zone, after the time exclusively", () => {
    // 09:00 in Tokyo is midnight UTC, the base time itself, so it is skipped.
    expect(cron.nextRuns("0 0 9 * * *", "Asia/Tokyo", NEW_YEAR_2026, 2)).toEqual({
      runs: [at(2026, 1, 2), at(2026, 1, 3)],
    })
  })

  it("follows daylight saving time", () => {
    // New York moves to EDT (UTC-4) on 8 March 2026.
    expect(cron.nextRuns("0 0 9 * * *", "America/New_York", at(2026, 3, 7), 3)).toEqual({
      runs: [at(2026, 3, 7, 14), at(2026, 3, 8, 13), at(2026, 3, 9, 13)],
    })
  })

  it("requires both the day of month and the day of week when both are given", () => {
    // Friday the 13th only (2026: February, March, November), not every 13th or Friday.
    expect(cron.nextRuns("0 0 0 13 * FRI", "UTC", NEW_YEAR_2026, 3)).toEqual({
      runs: [at(2026, 2, 13), at(2026, 3, 13), at(2026, 11, 13)],
    })
  })

  it("treats day of week 7 as Sunday", () => {
    const sunday = { runs: [at(2026, 1, 4)] }
    expect(cron.nextRuns("0 0 0 * * 7", "UTC", NEW_YEAR_2026, 1)).toEqual(sunday)
    expect(cron.nextRuns("0 0 0 * * 0", "UTC", NEW_YEAR_2026, 1)).toEqual(sunday)
  })

  it("accepts a fractional time, as the clock gives it", () => {
    expect(cron.nextRuns("0 0 9 * * *", "UTC", NEW_YEAR_2026 + 0.7, 1)).toEqual({
      runs: [at(2026, 1, 1, 9)],
    })
  })

  it("reports a time that is not a number instead of throwing", () => {
    expect(cron.nextRuns("0 0 9 * * *", "UTC", Number.NaN, 1)).toEqual({
      error: expect.stringMatching(/.+/),
    })
  })

  it("reads a count as a whole number of at least zero", () => {
    const every = (count: number) => cron.nextRuns("0 * * * * *", "UTC", NEW_YEAR_2026, count)
    expect(every(-1)).toEqual({ runs: [] })
    expect(every(2.7)).toEqual({ runs: [NEW_YEAR_2026 + 60, NEW_YEAR_2026 + 120] })
  })

  it("returns as many runs as asked, up to 64", () => {
    const every = (count: number) => cron.nextRuns("0 * * * * *", "UTC", NEW_YEAR_2026, count)
    expect(every(0)).toEqual({ runs: [] })
    expect(every(1)).toEqual({ runs: [NEW_YEAR_2026 + 60] })
    expect(every(100)).toMatchObject({ runs: expect.any(Array) })
    expect((every(100) as { runs: number[] }).runs).toHaveLength(64)
  })

  it("reports an invalid expression, an unknown time zone and a schedule that never runs", () => {
    expect(cron.nextRuns("0 9 * * *", "UTC", NEW_YEAR_2026, 1)).toEqual({
      error: expect.stringMatching(/6 or 7 fields/),
    })
    expect(cron.nextRuns("0 0 9 * * *", "Mars/Olympus", NEW_YEAR_2026, 1)).toEqual({
      error: expect.stringMatching(/Mars\/Olympus/),
    })
    expect(cron.nextRuns("0 0 0 1 1 * 2020", "UTC", NEW_YEAR_2026, 1)).toEqual({
      error: expect.stringMatching(/.+/),
    })
  })
})

describe("RustCron.knowsTimeZone", () => {
  it("reads zone names as conductor does, which is stricter than the browser", () => {
    expect(cron.knowsTimeZone("Asia/Tokyo")).toBe(true)
    expect(cron.knowsTimeZone("UTC")).toBe(true)
    // The browser accepts these; conductor's chrono-tz does not.
    expect(cron.knowsTimeZone("asia/tokyo")).toBe(false)
    expect(cron.knowsTimeZone("Mars/Olympus")).toBe(false)
  })
})
