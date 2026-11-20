import { beforeAll, describe, expect, it } from "vitest"
import { loadTestRustCron } from "@/test/wasm"
import { CRON_PRESETS, normalizeCrontab, restrictsBothDays } from "./crontab"
import type { RustCron } from "./rust-cron"

let cron: RustCron
beforeAll(async () => {
  cron = await loadTestRustCron()
})

describe("normalizeCrontab", () => {
  it("adds a zero seconds field to a five-field expression", () => {
    expect(normalizeCrontab("30 9 * * MON-FRI")).toEqual({
      expression: "0 30 9 * * MON-FRI",
      secondsAdded: true,
    })
  })

  it("keeps six- and seven-field expressions and aliases as they are", () => {
    for (const expression of ["0 30 9 * * *", "0 0 0 1 1 * 2030", "@daily"]) {
      expect(normalizeCrontab(expression)).toEqual({ expression, secondsAdded: false })
    }
  })

  it("trims and joins fields with single spaces", () => {
    expect(normalizeCrontab("  0  30\t9 * * *  ")).toEqual({
      expression: "0 30 9 * * *",
      secondsAdded: false,
    })
    expect(normalizeCrontab(" 30 9 * * * ").secondsAdded).toBe(true)
  })

  it("leaves other field counts to conductor's check", () => {
    for (const expression of ["", "* * * *", "0 0 0 * * * * *"]) {
      expect(normalizeCrontab(expression).secondsAdded).toBe(false)
    }
  })

  it("makes five-field input acceptable to conductor", () => {
    expect(cron.check("30 9 * * *")).toMatch(/.+/)
    expect(cron.check(normalizeCrontab("30 9 * * *").expression)).toBeUndefined()
  })
})

describe("restrictsBothDays", () => {
  it("is true only when neither day field is a wildcard", () => {
    expect(restrictsBothDays("0 0 0 13 * FRI")).toBe(true)
    expect(restrictsBothDays("0 0 0 1-7 * 1")).toBe(true)
    expect(restrictsBothDays("0 0 0 * * FRI")).toBe(false)
    expect(restrictsBothDays("0 0 0 13 * *")).toBe(false)
    expect(restrictsBothDays("0 0 0 13 * ?")).toBe(false)
    expect(restrictsBothDays("0 0 0 ? * MON")).toBe(false)
    expect(restrictsBothDays("@weekly")).toBe(false)
  })
})

describe("CRON_PRESETS", () => {
  it("are all accepted by conductor", () => {
    expect(CRON_PRESETS.length).toBeGreaterThanOrEqual(6)
    for (const { expression } of CRON_PRESETS) expect(cron.check(expression)).toBeUndefined()
  })
})
