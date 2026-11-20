import { describe, expect, it } from "vitest"
import { findEntity, toEntities, toNamed } from "./entities"

describe("toEntities", () => {
  it("unwraps ids and drops entries without an id or data", () => {
    expect(
      toEntities([
        { id: { value: "1" }, data: { name: "a" } },
        { id: undefined, data: { name: "no id" } },
        { id: { value: "3" }, data: undefined },
        { id: { value: "4" }, data: { name: "d" } },
      ]),
    ).toEqual([
      { id: "1", data: { name: "a" } },
      { id: "4", data: { name: "d" } },
    ])
  })
})

describe("findEntity", () => {
  const entities = [
    { id: "1", data: "a" },
    { id: "2", data: "b" },
  ]

  it("finds by id", () => {
    expect(findEntity(entities, "2")).toEqual({ id: "2", data: "b" })
  })

  it("returns undefined for a missing or absent id", () => {
    expect(findEntity(entities, "9")).toBeUndefined()
    expect(findEntity(entities, undefined)).toBeUndefined()
  })
})

describe("toNamed", () => {
  it("pairs ids with names", () => {
    expect(toNamed([{ id: "1", data: { name: "a" } }])).toEqual([{ id: "1", name: "a" }])
  })
})
