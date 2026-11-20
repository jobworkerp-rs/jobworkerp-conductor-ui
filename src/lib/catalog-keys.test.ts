import { describe, expect, it } from "vitest"
import { diffCatalogKeys } from "./catalog-keys"

describe("diffCatalogKeys", () => {
  it("reports missing and extra keys at any depth", () => {
    expect(
      diffCatalogKeys({ a: "x", b: { c: "y", d: "z" } }, { a: "x", b: { c: "y" }, e: "extra" }),
    ).toEqual({ missing: ["b.d"], extra: ["e"] })
  })

  it("treats plural forms of one key as the same key", () => {
    expect(
      diffCatalogKeys({ items_one: "1 item", items_other: "n items" }, { items_other: "n 件" }),
    ).toEqual({ missing: [], extra: [] })
  })

  it("reports a key that is a string in one catalog and a group in the other", () => {
    expect(diffCatalogKeys({ a: "x" }, { a: { b: "y" } })).toEqual({
      missing: ["a"],
      extra: ["a.b"],
    })
  })
})
