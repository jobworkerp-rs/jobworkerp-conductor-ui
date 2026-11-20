import type { JobworkerpServerLink } from "@/lib/runtime-config"
import type { ManagedWorkflowLookup } from "@/lib/services/managed-workflows"
import type { ManagedWorkerRef } from "./cleanup"
import { hasManagedWorkerName } from "./managed-worker"

export interface StoredTargetReading {
  /** False while the worker lookup a decision depends on is still running. */
  ready: boolean
  /** The definition when the target is an inline one, for fromStoredTarget. */
  managed?: { definition: string; channel: string }
  /** The managed worker is gone; saving creates it again. */
  managedWorkerMissing: boolean
  /** The managed worker the setting uses, for cleanup after a change. */
  previous?: ManagedWorkerRef
}

/**
 * How an edit page reads a stored target back (spec §4.6.4): a worker target
 * is an inline definition when jobworkerp holds it in one of our managed
 * workers. A managed-looking worker that is gone stays inline, with a
 * warning. Without a jobworkerp link nothing can be checked, so the worker is
 * a plain one.
 */
export function interpretStoredTarget({
  serverId,
  link,
  linked,
  workerName,
  lookup,
}: {
  serverId: string
  link: JobworkerpServerLink | undefined
  linked: boolean
  workerName: string | undefined
  /** Undefined while pending. */
  lookup: ManagedWorkflowLookup | undefined
}): StoredTargetReading {
  if (!workerName || !linked) return { ready: true, managedWorkerMissing: false }
  if (!lookup) return { ready: false, managedWorkerMissing: false }
  const previous = { serverId, workerName, link }
  if (lookup.status === "found") {
    return {
      ready: true,
      managed: { definition: lookup.definition, channel: lookup.channel },
      managedWorkerMissing: false,
      previous,
    }
  }
  if (lookup.status === "missing" && hasManagedWorkerName(workerName)) {
    return {
      ready: true,
      managed: { definition: "", channel: "" },
      managedWorkerMissing: true,
      previous,
    }
  }
  return { ready: true, managedWorkerMissing: false }
}
