import { classifyError } from "./errors"

export type Reachability = "notConfigured" | "checking" | "reachable" | "unreachable"

/** Only a missing reply means unreachable; a gRPC error status proves the endpoint answers. */
export function reachabilityOf(state: {
  configured: boolean
  pending: boolean
  error: unknown
}): Reachability {
  if (!state.configured) return "notConfigured"
  if (state.error) {
    const { kind } = classifyError(state.error)
    return kind === "network" || kind === "http" ? "unreachable" : "reachable"
  }
  return state.pending ? "checking" : "reachable"
}

/**
 * The linked servers' reachability, for a summary: the count is only final
 * once each has answered.
 */
export function summarizeReachability(
  states: readonly Reachability[],
): "none" | "checking" | { reachable: number; linked: number } {
  if (states.length === 0) return "none"
  if (states.includes("checking")) return "checking"
  return { reachable: states.filter((s) => s === "reachable").length, linked: states.length }
}
