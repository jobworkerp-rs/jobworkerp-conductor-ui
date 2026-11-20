/// <reference types="node" />
import { readFileSync } from "node:fs"
import { instantiateRustCron } from "@/lib/schedules/rust-cron"
import { instantiateRustRegex } from "@/lib/slack/rust-regex"

// The committed modules (tests run from the repository root).
export const readSlackRegexWasm = () => readFileSync("src/lib/slack/slack-regex.wasm")
export const loadTestRustRegex = () => instantiateRustRegex(readSlackRegexWasm())
export const loadTestRustCron = () =>
  instantiateRustCron(readFileSync("src/lib/schedules/cron.wasm"))
