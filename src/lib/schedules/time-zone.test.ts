import { describe, expect, it } from "vitest"
import { cronTimeZone, hasDaylightSaving } from "./time-zone"

describe("hasDaylightSaving", () => {
  it("tells zones with a seasonal offset from those without", () => {
    expect(hasDaylightSaving("America/New_York", 2026)).toBe(true)
    expect(hasDaylightSaving("Europe/Berlin", 2026)).toBe(true)
    expect(hasDaylightSaving("Australia/Sydney", 2026)).toBe(true)
    expect(hasDaylightSaving("Asia/Tokyo", 2026)).toBe(false)
    expect(hasDaylightSaving("UTC", 2026)).toBe(false)
  })
})

describe("cronTimeZone", () => {
  const knows = (name: string) => ["Asia/Tokyo", "UTC"].includes(name)

  it("uses the configured zone", () => {
    expect(cronTimeZone({ cronTimezone: "Asia/Tokyo" }, knows)).toEqual({
      timeZone: "Asia/Tokyo",
      configured: true,
    })
  })

  it("falls back to UTC without a zone, as conductor does", () => {
    expect(cronTimeZone({}, knows)).toEqual({ timeZone: "UTC", configured: false })
  })

  it("falls back to UTC for a name conductor cannot read, keeping the name", () => {
    expect(cronTimeZone({ cronTimezone: "asia/tokyo" }, knows)).toEqual({
      timeZone: "UTC",
      configured: true,
      rejected: "asia/tokyo",
    })
  })

  it("keeps the name while the rules that tell are not loaded", () => {
    expect(cronTimeZone({ cronTimezone: "asia/tokyo" })).toEqual({
      timeZone: "asia/tokyo",
      configured: true,
    })
  })
})
