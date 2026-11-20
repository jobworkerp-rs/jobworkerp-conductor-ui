import { describe, expect, it } from "vitest"
import {
  formatDateTime,
  formatDuration,
  formatNumber,
  formatRelative,
  toEpochSeconds,
} from "./format"

// 2026-01-02T03:04:05Z
const INSTANT = 1767323045

describe("formatDateTime", () => {
  it("renders in the requested time zone", () => {
    expect(formatDateTime(INSTANT, "en", "UTC")).toContain("03:04:05")
    expect(formatDateTime(INSTANT, "en", "Asia/Tokyo")).toContain("12:04:05")
  })

  it("names the time zone when asked", () => {
    expect(formatDateTime(INSTANT, "en", "Asia/Tokyo", { withZone: true })).toMatch(/GMT\+9|JST/)
  })

  it("uses the locale's date order", () => {
    expect(formatDateTime(INSTANT, "ja", "UTC")).toMatch(/^2026\/01\/02/)
  })
})

describe("formatRelative", () => {
  it.each([
    [-30, "en", "30 seconds ago"],
    [-120, "en", "2 minutes ago"],
    [-7200, "en", "2 hours ago"],
    [3 * 86400, "en", "in 3 days"],
    [-120, "ja", "2 分前"],
  ] as const)("renders %ss as %s", (offset, lang, expected) => {
    expect(formatRelative(INSTANT + offset, lang, INSTANT)).toBe(expected)
  })
})

describe("formatNumber", () => {
  it("groups digits per locale", () => {
    expect(formatNumber(1234567, "en")).toBe("1,234,567")
  })
})

describe("toEpochSeconds", () => {
  it("drops the fraction and gives the int64 string the API expects", () => {
    expect(toEpochSeconds(1_700_000_000.9)).toBe("1700000000")
  })
})

describe("formatDuration", () => {
  it("picks a unit that reads well", () => {
    expect(formatDuration(450, "en")).toBe("450 ms")
    expect(formatDuration(2500, "en")).toBe("2.5 sec")
    expect(formatDuration(90_000, "en")).toBe("1.5 min")
    expect(formatDuration(5_400_000, "en")).toBe("1.5 hr")
    expect(formatDuration(2500, "ja")).toBe("2.5 秒")
  })
})
