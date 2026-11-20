import type { ConfigKind } from "@/lib/execution-target/form"
import { hasManagedWorkerName } from "@/lib/execution-target/managed-worker"
import type { ImportResult } from "@/lib/services/config-management"
import type { ConfigSnapshot } from "@/lib/servers/references"
import { TARGET_KIND, TARGET_SETTING_KINDS, targetServerIdOf } from "@/lib/settings"

/** A setting that runs a jobworkerp worker, and the server it runs on. */
export interface WorkerTarget {
  kind: ConfigKind
  id: string
  name: string
  serverId: string
  workerName: string
}

/**
 * The settings that run a worker. Those whose worker the UI manages store a
 * workflow definition in jobworkerp, which a TOML export does not carry.
 */
export function workerTargets(snapshot: ConfigSnapshot): WorkerTarget[] {
  return TARGET_SETTING_KINDS.flatMap((kind) =>
    snapshot[kind].flatMap(({ id, data }) =>
      data.worker
        ? [
            {
              kind: TARGET_KIND[kind],
              id,
              name: data.name,
              serverId: targetServerIdOf(kind, data),
              workerName: data.worker.workerName,
            },
          ]
        : [],
    ),
  )
}

export const targetKey = (target: WorkerTarget) => `${target.kind}:${target.id}`

/**
 * Which settings keep their definition in a managed worker. `isManaged` is
 * undefined where the worker could not be looked up (no browser link, or
 * jobworkerp unreachable); those count as unverified if named like a
 * managed worker.
 */
export function classifyWorkerTargets<T extends WorkerTarget>(
  targets: readonly T[],
  isManaged: (target: T) => boolean | undefined,
): { managed: T[]; unverified: T[] } {
  const managed: T[] = []
  const unverified: T[] = []
  for (const target of targets) {
    const verdict = isManaged(target)
    if (verdict) managed.push(target)
    else if (verdict === undefined && hasManagedWorkerName(target.workerName)) {
      unverified.push(target)
    }
  }
  return { managed, unverified }
}

/** Each worker once per server, as several settings may share one. */
export function uniqueWorkers<T extends { serverId: string; workerName: string }>(
  workers: readonly T[],
): T[] {
  const seen = new Set<string>()
  return workers.filter((w) => {
    const key = JSON.stringify([w.serverId, w.workerName])
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

const pad = (n: number) => String(n).padStart(2, "0")

export function exportFileName(at: Date): string {
  const date = `${at.getFullYear()}${pad(at.getMonth() + 1)}${pad(at.getDate())}`
  const time = `${pad(at.getHours())}${pad(at.getMinutes())}${pad(at.getSeconds())}`
  return `conductor-settings-${date}-${time}.toml`
}

/** A validation run, with what it was run on. */
export interface Validated {
  toml: string
  overwrite: boolean
  result: ImportResult
}

/** Whether a validation was run on exactly the current content and choice. */
export function isCurrent(
  validated: Validated | undefined,
  toml: string,
  overwrite: boolean,
): validated is Validated {
  return validated?.toml === toml && validated.overwrite === overwrite
}

/** Importing waits for a passing validation of exactly what would be imported. */
export function canImport(
  validated: Validated | undefined,
  toml: string,
  overwrite: boolean,
): boolean {
  return isCurrent(validated, toml, overwrite) && validated.result.ok
}
