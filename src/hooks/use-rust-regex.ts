import { loadRustRegex } from "@/lib/slack/load-rust-regex"
import { useWasmModule } from "./use-wasm-module"

/**
 * conductor's regex rules in the browser. Undefined while loading or if the
 * module cannot be loaded; patterns are then left to conductor's check on
 * save (spec §6.5).
 */
export function useRustRegex() {
  return useWasmModule("slack-regex", loadRustRegex).module
}
