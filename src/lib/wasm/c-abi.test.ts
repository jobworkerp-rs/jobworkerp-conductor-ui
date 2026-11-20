import { describe, expect, it } from "vitest"
import { readSlackRegexWasm as bytes } from "@/test/wasm"
import { instantiateCAbi } from "./c-abi"

// The regex module is the smallest real module speaking the shared ABI.
interface RegexExports {
  is_match(patternPtr: number, patternLen: number, textPtr: number, textLen: number): number
}

describe("instantiateCAbi", () => {
  it("passes strings in and reads error messages back", async () => {
    const { wasm, withStrings, lastError } = await instantiateCAbi<RegexExports>(bytes())
    expect(withStrings(["^ok$"], ([ptr, len]) => wasm.check(ptr, len))).toBe(0)
    expect(withStrings(["("], ([ptr, len]) => wasm.check(ptr, len))).toBe(-1)
    expect(lastError()).toMatch(/unclosed group/)
  })

  it("checks a string with the module's own rules", async () => {
    const { check } = await instantiateCAbi(bytes())
    expect(check("^ok$")).toBeUndefined()
    expect(check("(")).toMatch(/unclosed group/)
  })

  it("passes several strings and reports a failure of any of them", async () => {
    const { wasm, withStrings, lastError } = await instantiateCAbi<RegexExports>(bytes())
    const isMatch = (pattern: string, text: string) =>
      withStrings([pattern, text], ([pp, pl, tp, tl]) => wasm.is_match(pp, pl, tp, tl))
    expect(isMatch("^デ", "デプロイ")).toBe(1)
    expect(isMatch("(", "x")).toBe(-1)
    expect(lastError()).toMatch(/unclosed group/)
  })

  it("passes multi-byte text by its UTF-8 length", async () => {
    const { withStrings } = await instantiateCAbi<RegexExports>(bytes())
    expect(withStrings(["デプロイ", "a"], (args) => args.filter((_, i) => i % 2 === 1))).toEqual([
      12, 1,
    ])
  })

  it("releases the strings even when the call throws", async () => {
    const { wasm, withStrings } = await instantiateCAbi<RegexExports>(bytes())
    const size = () => wasm.memory.buffer.byteLength
    const text = "x".repeat(1 << 20)
    const fail = () =>
      withStrings([text], () => {
        throw new Error("boom")
      })
    expect(fail).toThrow("boom")
    const after = size()
    // Freed memory is reused, so repeating the call does not grow memory.
    for (let i = 0; i < 20; i++) expect(fail).toThrow("boom")
    expect(size()).toBe(after)
  })

  it("compiles a fetch response, with or without the wasm content type", async () => {
    for (const type of ["application/wasm", "application/octet-stream"]) {
      const response = new Response(bytes(), { headers: { "content-type": type } })
      const { check } = await instantiateCAbi(response)
      expect(check("a")).toBeUndefined()
    }
  })

  it("refuses a module that needs imports", async () => {
    // (module (import "env" "f" (func)))
    const needsImport = new Uint8Array([
      0, 97, 115, 109, 1, 0, 0, 0, 1, 4, 1, 96, 0, 0, 2, 9, 1, 3, 101, 110, 118, 1, 102, 0, 0,
    ])
    await expect(instantiateCAbi(needsImport)).rejects.toThrow()
  })
})
