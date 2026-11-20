import { beforeAll, describe, expect, it } from "vitest"
import { loadTestRustRegex } from "@/test/wasm"
import type { RustRegex } from "./rust-regex"

let regex: RustRegex
beforeAll(async () => {
  regex = await loadTestRustRegex()
})

describe("RustRegex.check", () => {
  it("accepts what Rust's regex accepts, even where JavaScript refuses", () => {
    // Inline flags and verbose mode exist in Rust but not as such in JS.
    const verbose = "(?x) a b # comment"
    for (const pattern of ["(?i)deploy", verbose, "\\p{Greek}+"]) {
      expect(regex.check(pattern)).toBeUndefined()
    }
    expect(() => new RegExp(verbose)).toThrow()
  })

  it("refuses what Rust's regex refuses, even where JavaScript accepts", () => {
    // Look-around and backreferences are not supported by Rust's regex.
    for (const pattern of ["a(?=b)", "(a)\\1"]) {
      expect(regex.check(pattern)).toMatch(/.+/)
      expect(() => new RegExp(pattern)).not.toThrow()
    }
  })

  it("explains a syntax error", () => {
    expect(regex.check("(")).toMatch(/unclosed group/)
  })
})

describe("RustRegex.isMatch", () => {
  it("matches with Rust's semantics", () => {
    expect(regex.isMatch("(?i)^deploy", "Deploy now")).toBe(true)
    expect(regex.isMatch("^deploy$", "deploy now")).toBe(false)
    // \d is Unicode-aware in Rust: Arabic-Indic digits match, unlike in JS.
    expect(regex.isMatch("^\\d$", "١")).toBe(true)
    expect(/^\d$/.test("١")).toBe(false)
  })

  it("handles multi-byte text", () => {
    expect(regex.isMatch("デプロイ", "本番にデプロイして")).toBe(true)
  })

  it("keeps answers right while patterns alternate (the last compilation is reused)", () => {
    for (let round = 0; round < 3; round++) {
      expect(regex.isMatch("^a", "abc")).toBe(true)
      expect(regex.check("(")).toMatch(/unclosed group/)
      expect(regex.isMatch("^b", "abc")).toBe(false)
      expect(regex.check("^a")).toBeUndefined()
    }
  })

  it("is undefined for an invalid pattern", () => {
    expect(regex.isMatch("(", "x")).toBeUndefined()
  })
})
