import { describe, expect, it } from "vitest"
import { LIST_SCALE_LIMIT, exceedsListScale, paginate, parsePageParam } from "./pagination"

const items = Array.from({ length: 45 }, (_, i) => i + 1)

describe("paginate", () => {
  it("returns the requested page with its range", () => {
    expect(paginate(items, 2, 20)).toEqual({
      items: items.slice(20, 40),
      page: 2,
      totalPages: 3,
      total: 45,
      from: 21,
      to: 40,
      hasNext: true,
    })
  })

  it("returns a short last page", () => {
    const result = paginate(items, 3, 20)
    expect(result.items).toEqual([41, 42, 43, 44, 45])
    expect([result.from, result.to]).toEqual([41, 45])
    expect(result.hasNext).toBe(false)
  })

  it("handles an exact multiple of the page size", () => {
    expect(paginate(items.slice(0, 40), 2, 20).totalPages).toBe(2)
  })

  it.each([
    [0, 1],
    [-3, 1],
    [99, 3],
  ])("clamps page %s to %s", (requested, expected) => {
    expect(paginate(items, requested, 20).page).toBe(expected)
  })

  it("treats an empty list as one empty page", () => {
    expect(paginate([], 5, 20)).toEqual({
      items: [],
      page: 1,
      totalPages: 1,
      total: 0,
      from: 0,
      to: 0,
      hasNext: false,
    })
  })
})

describe("parsePageParam", () => {
  it.each([
    [null, 1],
    ["", 1],
    ["3", 3],
    ["0", 1],
    ["-2", 1],
    ["2.7", 2],
    ["abc", 1],
  ])("parses %j as %s", (value, expected) => {
    expect(parsePageParam(value)).toBe(expected)
  })
})

describe("exceedsListScale", () => {
  it("warns only above 1,000 entries", () => {
    expect(exceedsListScale(LIST_SCALE_LIMIT)).toBe(false)
    expect(exceedsListScale(LIST_SCALE_LIMIT + 1)).toBe(true)
    expect(LIST_SCALE_LIMIT).toBe(1_000)
  })
})
