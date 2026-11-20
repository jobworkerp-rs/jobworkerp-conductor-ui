import { instantiateCAbi } from "@/lib/wasm/c-abi"

/**
 * conductor's Slack handler regex rules (Rust's regex crate, compiled to
 * WebAssembly from wasm/slack-regex). Browser regexes differ in syntax and
 * semantics, so patterns are checked and tried with this instead (spec §6.5).
 */
export interface RustRegex {
  /** Undefined when the pattern compiles; otherwise the compiler's message. */
  check(pattern: string): string | undefined
  /** Undefined when the pattern does not compile. */
  isMatch(pattern: string, text: string): boolean | undefined
}

interface Exports {
  is_match(patternPtr: number, patternLen: number, textPtr: number, textLen: number): number
}

/** Accepts the module's bytes, or a fetch response to compile while it downloads. */
export async function instantiateRustRegex(source: BufferSource | Response): Promise<RustRegex> {
  const { wasm, withStrings, check } = await instantiateCAbi<Exports>(source)
  return {
    check,
    isMatch(pattern, text) {
      const result = withStrings([pattern, text], ([pp, pl, tp, tl]) =>
        wasm.is_match(pp, pl, tp, tl),
      )
      return result < 0 ? undefined : result === 1
    },
  }
}
