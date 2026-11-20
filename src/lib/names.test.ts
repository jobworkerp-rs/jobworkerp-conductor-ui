import { describe, expect, it } from "vitest"
import { findDuplicateName } from "./names"

const entries = [
  { id: "1", name: "daily-report" },
  { id: "2", name: "health-ping" },
]

describe("findDuplicateName", () => {
  it("finds another entry with the same name", () => {
    expect(findDuplicateName("health-ping", entries)).toEqual(entries[1])
  })

  it("ignores the entry being edited", () => {
    expect(findDuplicateName("health-ping", entries, "2")).toBeUndefined()
  })

  it("compares names exactly, as the API does", () => {
    expect(findDuplicateName("Health-Ping", entries)).toBeUndefined()
    expect(findDuplicateName("health-ping ", entries)).toBeUndefined()
  })

  it("does not report an empty name", () => {
    expect(findDuplicateName("", [{ id: "9", name: "" }])).toBeUndefined()
  })
})
