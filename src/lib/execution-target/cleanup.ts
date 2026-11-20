import type { JobworkerpServerLink } from "@/lib/runtime-config"
import type { ExecutionTargetForm } from "./form"

/**
 * Two conductor servers may point at one jobworkerp. The browser-facing URL
 * is the only identity the UI can compare; without it, assume they differ.
 */
export function sameJobworkerp(
  a: JobworkerpServerLink | undefined,
  b: JobworkerpServerLink | undefined,
): boolean {
  return a?.grpcWebUrl !== undefined && a.grpcWebUrl === b?.grpcWebUrl
}

/** A managed workflow worker: its name and the conductor server it lives on. */
export interface ManagedWorkerRef {
  serverId: string
  workerName: string
  link: JobworkerpServerLink | undefined
}

/**
 * The managed worker a save or delete leaves unused, if any (spec §4.6.4).
 * It is only a candidate: the user may keep it.
 */
export function obsoleteManagedWorker(
  before: ManagedWorkerRef | undefined,
  after: ManagedWorkerRef | undefined,
): ManagedWorkerRef | undefined {
  if (!before) return undefined
  if (!after) return before
  const sameHome = before.serverId === after.serverId || sameJobworkerp(before.link, after.link)
  return sameHome && before.workerName === after.workerName ? undefined : before
}

/** The managed worker an inline target stores its definition in. */
export function managedWorkerOf(
  form: ExecutionTargetForm,
  link: JobworkerpServerLink | undefined,
): ManagedWorkerRef | undefined {
  return form.method === "workflowInline"
    ? { serverId: form.serverId, workerName: form.managedWorkerName.trim(), link }
    : undefined
}
