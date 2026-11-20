import { fetchWasm } from "@/lib/wasm/fetch"
import wasmUrl from "./cron.wasm?url"
import { instantiateRustCron, type RustCron } from "./rust-cron"

/** The module is large, so only the schedule screens load it. */
export async function loadRustCron(): Promise<RustCron> {
  return instantiateRustCron(await fetchWasm(wasmUrl))
}
