import { describe, expect, it } from "vitest"
import { NAV_ITEMS, isNavItemActive, navPath } from "./navigation"

const byPath = (path: string) => NAV_ITEMS.find((item) => item.path === path)!

describe("isNavItemActive", () => {
  it("marks the dashboard active only on the root", () => {
    expect(isNavItemActive(byPath("/"), "/")).toBe(true)
    expect(isNavItemActive(byPath("/"), "/servers")).toBe(false)
  })

  it("marks a section active on its sub-pages", () => {
    expect(isNavItemActive(byPath("/executions"), "/executions/123")).toBe(true)
    expect(isNavItemActive(byPath("/servers"), "/servers")).toBe(true)
  })

  it("does not match a different path sharing a prefix", () => {
    expect(isNavItemActive(byPath("/servers"), "/servers-old")).toBe(false)
  })

  it("lists the seven screens of the spec in order", () => {
    expect(NAV_ITEMS.map((item) => item.path)).toEqual([
      "/",
      "/servers",
      "/schedules",
      "/result-handlers",
      "/slack-handlers",
      "/executions",
      "/settings",
    ])
  })
})

describe("navPath", () => {
  it("gives the path of a screen by its key", () => {
    expect(navPath("schedules")).toBe("/schedules")
    expect(navPath("resultHandlers")).toBe("/result-handlers")
  })
})
