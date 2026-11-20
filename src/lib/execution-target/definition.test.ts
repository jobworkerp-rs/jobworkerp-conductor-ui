import { parse } from "yaml"
import { describe, expect, it } from "vitest"
import { WORKFLOW_TEMPLATE, checkDefinitionSyntax } from "./definition"

describe("checkDefinitionSyntax", () => {
  it("accepts YAML and JSON documents", () => {
    expect(checkDefinitionSyntax("do:\n  - a:\n      set: {}\n")).toBeUndefined()
    expect(checkDefinitionSyntax('{"do": []}')).toBeUndefined()
  })

  it("requires a definition", () => {
    expect(checkDefinitionSyntax("  \n")).toEqual({ key: "common.formErrors.required" })
  })

  it("reports the line and column of a syntax error", () => {
    // " z" is indented one column less than its sibling "y"; the error marks that indent.
    const error = checkDefinitionSyntax("x:\n  y: 1\n z: 2\n")
    expect(error).toMatchObject({
      key: "executionTarget.definition.errors.syntax",
      line: 3,
      column: 1,
    })
    expect(error?.detail).toBeTruthy()
  })

  it("requires a mapping at the top level", () => {
    expect(checkDefinitionSyntax("- a\n- b\n")?.key).toBe(
      "executionTarget.definition.errors.notObject",
    )
    expect(checkDefinitionSyntax("just text")?.key).toBe(
      "executionTarget.definition.errors.notObject",
    )
  })
})

describe("WORKFLOW_TEMPLATE", () => {
  it("is a valid definition that returns its input", () => {
    expect(checkDefinitionSyntax(WORKFLOW_TEMPLATE)).toBeUndefined()
    expect(parse(WORKFLOW_TEMPLATE)).toMatchObject({ document: { dsl: "1.0.0" } })
  })
})
