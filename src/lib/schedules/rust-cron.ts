import { instantiateCAbi } from "@/lib/wasm/c-abi"

export type NextRuns = { runs: number[] } | { error: string }

/**
 * conductor's cron rules (croner, configured as tokio-cron-scheduler does,
 * compiled to WebAssembly from wasm/cron). conductor does not check
 * expressions on save, only when it schedules them, so the screens decide
 * acceptance with exactly its parser (spec §6.3).
 */
export interface RustCron {
  /** Undefined when conductor accepts the expression; otherwise croner's message. */
  check(expression: string): string | undefined
  /** The next `count` (at most 64) runs after `afterSeconds`, as UNIX seconds. */
  nextRuns(expression: string, timeZone: string, afterSeconds: number, count: number): NextRuns
  /** Whether conductor can read the zone name; the browser accepts more (e.g. any case). */
  knowsTimeZone(name: string): boolean
}

interface Exports {
  next_runs(
    expressionPtr: number,
    expressionLen: number,
    timeZonePtr: number,
    timeZoneLen: number,
    afterSeconds: bigint,
    count: number,
  ): number
  runs_ptr(): number
  check_time_zone(ptr: number, len: number): number
}

/** Accepts the module's bytes, or a fetch response to compile while it downloads. */
export async function instantiateRustCron(source: BufferSource | Response): Promise<RustCron> {
  const { wasm, withStrings, lastError, check, checkWith } = await instantiateCAbi<Exports>(source)
  return {
    check,
    nextRuns(expression, timeZone, afterSeconds, count) {
      // BigInt throws on these, and a negative count would wrap as a u32.
      if (!Number.isFinite(afterSeconds)) return { error: `invalid time: ${afterSeconds}` }
      const wanted = Number.isFinite(count) ? Math.max(0, Math.trunc(count)) : 0
      const found = withStrings([expression, timeZone], ([ep, el, tp, tl]) =>
        wasm.next_runs(ep, el, tp, tl, BigInt(Math.floor(afterSeconds)), wanted),
      )
      if (found < 0) return { error: lastError() }
      const runs = new BigInt64Array(wasm.memory.buffer, wasm.runs_ptr(), found)
      return { runs: Array.from(runs, Number) }
    },
    knowsTimeZone(name) {
      return checkWith(wasm.check_time_zone, name) === undefined
    },
  }
}
