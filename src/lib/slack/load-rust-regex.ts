import { fetchWasm } from "@/lib/wasm/fetch"
import wasmUrl from "./slack-regex.wasm?url"
import { instantiateRustRegex, type RustRegex } from "./rust-regex"

/** The module is large, so only the Slack screens load it. */
export async function loadRustRegex(): Promise<RustRegex> {
  return instantiateRustRegex(await fetchWasm(wasmUrl))
}
