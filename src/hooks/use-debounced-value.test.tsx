import { act, renderHook } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { useDebouncedValue } from "./use-debounced-value"

describe("useDebouncedValue", () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it("follows the value once it stops changing for the delay", () => {
    const { result, rerender } = renderHook(({ value }) => useDebouncedValue(value, 250), {
      initialProps: { value: "a" },
    })
    expect(result.current).toBe("a")
    rerender({ value: "ab" })
    act(() => vi.advanceTimersByTime(200))
    rerender({ value: "abc" })
    act(() => vi.advanceTimersByTime(200))
    expect(result.current).toBe("a")
    act(() => vi.advanceTimersByTime(50))
    expect(result.current).toBe("abc")
  })
})
