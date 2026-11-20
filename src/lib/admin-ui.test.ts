import { describe, expect, it } from "vitest"
import { adminUiUrl } from "./admin-ui"

describe("adminUiUrl", () => {
  it.each([
    [{ page: "dashboard" }, "http://ui.example.com/"],
    [{ page: "workers" }, "http://ui.example.com/workers"],
    [{ page: "jobs" }, "http://ui.example.com/jobs"],
    [{ page: "results" }, "http://ui.example.com/results"],
    [{ page: "worker", id: "42" }, "http://ui.example.com/workers/42"],
    [{ page: "job", id: "7" }, "http://ui.example.com/jobs/7"],
    [{ page: "result", id: "9" }, "http://ui.example.com/results/9"],
  ] as const)("links %o to the admin-ui route", (target, expected) => {
    expect(adminUiUrl("http://ui.example.com", target)).toBe(expected)
  })

  it("gives the same URL with or without a trailing slash", () => {
    expect(adminUiUrl("http://ui.example.com/", { page: "workers" })).toBe(
      "http://ui.example.com/workers",
    )
  })

  it("keeps a path prefix", () => {
    expect(adminUiUrl("https://example.com/admin/", { page: "job", id: "1" })).toBe(
      "https://example.com/admin/jobs/1",
    )
    expect(adminUiUrl("https://example.com/admin", { page: "dashboard" })).toBe(
      "https://example.com/admin/",
    )
  })

  it("encodes the id", () => {
    expect(adminUiUrl("http://x", { page: "worker", id: "a/b" })).toBe("http://x/workers/a%2Fb")
  })
})
