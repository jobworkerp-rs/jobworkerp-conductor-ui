import { describe, expect, it } from "vitest"
import {
  ACTIVE_REFRESH_MS,
  DEFAULT_REFRESH_SECONDS,
  REFRESH_INTERVALS,
  parseRefreshSeconds,
  refetchInterval,
} from "./refresh"

describe("refetchInterval", () => {
  it("polls at the chosen interval when nothing is running", () => {
    expect(refetchInterval({ autoRefresh: true, idleMs: 30_000, hasActive: false })).toBe(30_000)
    expect(refetchInterval({ autoRefresh: true, idleMs: 120_000, hasActive: false })).toBe(120_000)
  })

  it("polls every 5 seconds while something is running, whatever the interval", () => {
    expect(refetchInterval({ autoRefresh: true, idleMs: 60_000, hasActive: true })).toBe(
      ACTIVE_REFRESH_MS,
    )
    expect(ACTIVE_REFRESH_MS).toBe(5_000)
  })

  it("stops polling when auto refresh is off", () => {
    expect(refetchInterval({ autoRefresh: false, idleMs: 30_000, hasActive: true })).toBe(false)
    expect(refetchInterval({ autoRefresh: false, idleMs: 30_000, hasActive: false })).toBe(false)
  })
})

describe("parseRefreshSeconds", () => {
  it("offers 10, 30, 60 and 120 seconds, 30 by default (spec §4.3)", () => {
    expect(REFRESH_INTERVALS).toEqual([10, 30, 60, 120])
    expect(DEFAULT_REFRESH_SECONDS).toBe(30)
  })

  it("reads a stored choice", () => {
    expect(parseRefreshSeconds("10")).toBe(10)
    expect(parseRefreshSeconds("120")).toBe(120)
  })

  it("falls back to the default for nothing stored or a value not offered", () => {
    expect(parseRefreshSeconds(null)).toBe(30)
    expect(parseRefreshSeconds("15")).toBe(30)
    expect(parseRefreshSeconds("abc")).toBe(30)
  })
})
