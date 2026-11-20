import { describe, expect, it } from "vitest"
import { countEnabled, matchesNameStatus, parseNameStatusFilter } from "./list-filter"

describe("parseNameStatusFilter", () => {
  it("reads the name query and a known status", () => {
    expect(parseNameStatusFilter(new URLSearchParams("q=dep&status=disabled&page=2"))).toEqual({
      q: "dep",
      status: "disabled",
    })
    expect(parseNameStatusFilter(new URLSearchParams("status=other"))).toEqual({})
  })
})

describe("matchesNameStatus", () => {
  const entry = { name: "Deploy-Notice", enabled: true }
  it("matches names case-insensitively and the enabled state", () => {
    expect(matchesNameStatus(entry, {})).toBe(true)
    expect(matchesNameStatus(entry, { q: "notice" })).toBe(true)
    expect(matchesNameStatus(entry, { q: "other" })).toBe(false)
    expect(matchesNameStatus(entry, { status: "enabled" })).toBe(true)
    expect(matchesNameStatus(entry, { status: "disabled" })).toBe(false)
  })
})

describe("countEnabled", () => {
  it("counts enabled entries out of all", () => {
    expect(
      countEnabled([
        { data: { enabled: true } },
        { data: { enabled: false } },
        { data: { enabled: true } },
      ]),
    ).toEqual({ enabled: 2, total: 3 })
    expect(countEnabled([])).toEqual({ enabled: 0, total: 0 })
  })
})
