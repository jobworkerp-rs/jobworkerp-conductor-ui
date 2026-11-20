import { renderHook } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { IDLE_REFRESH_MS } from "@/lib/refresh"
import { createRuntimeWrapper } from "@/test/render"
import { useConfigList, useConfigSnapshot } from "./use-config"

// Only the queries' options are inspected; the default backend never answers.
function setup() {
  const { wrapper, queryClient } = createRuntimeWrapper()
  // Reads each observer's options: counting fetches over fake time would test
  // the same thing far more slowly. `observers` is not a documented API, so a
  // TanStack Query upgrade may need this one accessor adjusted.
  const intervalsOf = (kind: string) =>
    queryClient
      .getQueryCache()
      .find({ queryKey: ["config", kind] })!
      .observers.map((observer) => observer.options.refetchInterval)
  return { wrapper, intervalsOf }
}

describe("polling", () => {
  it("polls a page's own list", () => {
    const { wrapper, intervalsOf } = setup()
    renderHook(() => useConfigList("schedules"), { wrapper })
    expect(intervalsOf("schedules")).toEqual([IDLE_REFRESH_MS])
  })

  it("polls the reference lists only for a caller that shows them", () => {
    const { wrapper, intervalsOf } = setup()
    renderHook(() => useConfigSnapshot({ poll: true }), { wrapper })
    expect(intervalsOf("resultHandlers")).toEqual([IDLE_REFRESH_MS])
  })

  it("does not poll the lists read only for reference counts", () => {
    const { wrapper, intervalsOf } = setup()
    renderHook(() => useConfigSnapshot(), { wrapper })
    for (const kind of ["schedules", "slackHandlers", "resultHandlers"]) {
      expect(intervalsOf(kind)).toEqual([false])
    }
  })
})
