import { describe, expect, it } from "vitest"
import {
  DESCRIPTION_MAX_LENGTH,
  NAME_MAX_LENGTH,
  compactErrors,
  descriptionFieldError,
  hasErrors,
  requiredFieldError,
  nameFieldError,
  validateDescription,
  validateName,
} from "./validation"

describe("validateName", () => {
  it("requires a non-blank name of at most 100 characters, counting code points", () => {
    expect(validateName("")).toBe("common.formErrors.required")
    expect(validateName("   ")).toBe("common.formErrors.required")
    expect(validateName("a".repeat(NAME_MAX_LENGTH))).toBeUndefined()
    expect(validateName("a".repeat(NAME_MAX_LENGTH + 1))).toBe("common.formErrors.tooLong")
    // 100 emoji are 200 UTF-16 units but 100 characters.
    expect(validateName("😀".repeat(NAME_MAX_LENGTH))).toBeUndefined()
  })
})

describe("validateDescription", () => {
  it("allows an empty description and limits it to 500 characters", () => {
    expect(validateDescription("")).toBeUndefined()
    expect(validateDescription("説".repeat(DESCRIPTION_MAX_LENGTH))).toBeUndefined()
    expect(validateDescription("説".repeat(DESCRIPTION_MAX_LENGTH + 1))).toBe(
      "common.formErrors.tooLong",
    )
  })
})

describe("nameFieldError / descriptionFieldError", () => {
  it("carry the limit for too-long values only", () => {
    expect(nameFieldError("")).toEqual({ key: "common.formErrors.required" })
    expect(nameFieldError("a".repeat(NAME_MAX_LENGTH + 1))).toEqual({
      key: "common.formErrors.tooLong",
      values: { max: NAME_MAX_LENGTH },
    })
    expect(nameFieldError("ok")).toBeUndefined()
    expect(descriptionFieldError("x".repeat(DESCRIPTION_MAX_LENGTH + 1))).toEqual({
      key: "common.formErrors.tooLong",
      values: { max: DESCRIPTION_MAX_LENGTH },
    })
  })
})

describe("requiredFieldError / compactErrors / hasErrors", () => {
  it("flags blank values only", () => {
    expect(requiredFieldError(" ")).toEqual({ key: "common.formErrors.required" })
    expect(requiredFieldError("x")).toBeUndefined()
  })

  it("drops fields without an error", () => {
    const errors = compactErrors({ a: requiredFieldError(""), b: undefined })
    expect(errors).toEqual({ a: { key: "common.formErrors.required" } })
    expect(hasErrors(errors)).toBe(true)
    expect(hasErrors(compactErrors({ a: undefined }))).toBe(false)
  })
})
