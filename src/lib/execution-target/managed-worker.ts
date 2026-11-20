import {
  QueueType,
  ResponseType,
  RetryType,
  type RetryPolicy,
} from "@/lib/grpc/jobworkerp/data/common"
import type { WorkerData } from "@/lib/grpc/jobworkerp/data/worker"
import { FORM_ERRORS } from "@/lib/validation"
import { optional, type ConfigKind } from "./form"

/** jobworkerp's worker name rules (as enforced for function workers). */
export const MANAGED_WORKER_NAME_MAX = 128
const WORKER_NAME_PATTERN = /^[a-zA-Z][a-zA-Z0-9_-]*$/

const PREFIX = "conductor"
const KIND_SEGMENT: Record<ConfigKind, string> = {
  schedule: "schedule",
  slackHandler: "slack",
  resultHandler: "result",
}
// Ownership is told by the description, since users may rename the worker.
const DESCRIPTION_MARKER = "[jobworkerp-conductor-ui]"

/** FNV-1a: a short, stable suffix telling apart names whose slugs collide. */
function shortHash(text: string): string {
  let hash = 0x811c9dc5
  for (const char of text) {
    hash ^= char.codePointAt(0)!
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return hash.toString(36)
}

/** Default name of the worker storing a setting's inline workflow (spec §4.6.4). */
export function defaultManagedWorkerName(kind: ConfigKind, settingName: string): string {
  const head = `${PREFIX}-${KIND_SEGMENT[kind]}`
  const slug = settingName
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
  const suffix = slug === settingName ? "" : shortHash(settingName)
  const room = MANAGED_WORKER_NAME_MAX - head.length - 1 - (suffix ? suffix.length + 1 : 0)
  const parts = [head, slug.slice(0, room).replace(/-$/, ""), suffix].filter((part) => part !== "")
  return parts.join("-")
}

/** Whether a name looks like one defaultManagedWorkerName made, for workers that went missing. */
export function hasManagedWorkerName(name: string): boolean {
  return Object.values(KIND_SEGMENT).some((segment) => name.startsWith(`${PREFIX}-${segment}-`))
}

export function validateManagedWorkerName(name: string): string | undefined {
  if (name === "") return FORM_ERRORS.required
  if (name.length > MANAGED_WORKER_NAME_MAX) return FORM_ERRORS.tooLong
  if (!WORKER_NAME_PATTERN.test(name)) return "executionTarget.errors.workerNameSyntax"
  return undefined
}

export function managedWorkerDescription(kind: ConfigKind, settingName: string): string {
  return `${DESCRIPTION_MARKER} Inline workflow of ${KIND_SEGMENT[kind]} "${settingName}". Edit it from the conductor UI; changes made elsewhere are overwritten.`
}

export function isManagedWorker(worker: Pick<WorkerData, "description">): boolean {
  return worker.description.startsWith(DESCRIPTION_MARKER)
}

// The options conductor's jobworkerp client gives the workers it creates to
// run a workflow URL, so both workflow methods behave alike.
const RETRY_POLICY: RetryPolicy = {
  type: RetryType.EXPONENTIAL,
  interval: 800,
  maxInterval: 60_000,
  maxRetry: 1,
  basis: 2,
}

export function managedWorkerData(input: {
  name: string
  description: string
  runnerId: string
  runnerSettings: Uint8Array
  channel: string
}): WorkerData {
  return {
    name: input.name,
    description: input.description,
    runnerId: { value: input.runnerId },
    runnerSettings: input.runnerSettings,
    retryPolicy: RETRY_POLICY,
    periodicInterval: 0,
    channel: optional(input.channel),
    queueType: QueueType.NORMAL,
    responseType: ResponseType.DIRECT,
    storeSuccess: false,
    storeFailure: true,
    useStatic: false,
    broadcastResults: true,
  }
}
