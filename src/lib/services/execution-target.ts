import type { JobworkerpClients } from "@/lib/clients"
import { AppError } from "@/lib/errors"
import {
  managedWorkerOf,
  obsoleteManagedWorker,
  type ManagedWorkerRef,
} from "@/lib/execution-target/cleanup"
import {
  toStoredTarget,
  type ConfigKind,
  type ExecutionTargetForm,
  type StoredTarget,
} from "@/lib/execution-target/form"
import type { JobworkerpServerLink } from "@/lib/runtime-config"
import { deleteManagedWorkflow, saveWithManagedWorkflow } from "./managed-workflows"

/** What happened to a managed worker that a save or delete left unused. */
export type CleanupOutcome = "none" | "deleted" | "kept" | "failed"

export interface CleanupResult {
  cleanup: CleanupOutcome
  /** The worker the cleanup was about, for messages. */
  obsolete?: ManagedWorkerRef
  cleanupError?: unknown
}

/** Server id → browser-side jobworkerp clients; undefined when the server has no link. */
type ClientsFor = (serverId: string) => JobworkerpClients | undefined

function requireClients(clientsFor: ClientsFor, serverId: string): JobworkerpClients {
  const clients = clientsFor(serverId)
  if (!clients) throw new AppError("executionTarget.errors.inlineUnavailable")
  return clients
}

async function cleanUp(
  obsolete: ManagedWorkerRef | undefined,
  clientsFor: ClientsFor,
  keepObsolete: boolean,
): Promise<CleanupResult> {
  if (!obsolete) return { cleanup: "none" }
  if (keepObsolete) return { cleanup: "kept", obsolete }
  try {
    await deleteManagedWorkflow(requireClients(clientsFor, obsolete.serverId), obsolete.workerName)
    return { cleanup: "deleted", obsolete }
  } catch (err) {
    // The setting is already saved; a leftover worker is reported, not undone.
    return { cleanup: "failed", obsolete, cleanupError: err }
  }
}

export interface SaveSettingInput<T> {
  form: ExecutionTargetForm
  kind: ConfigKind
  settingName: string
  /** The managed worker the setting used before this save, if any. */
  previous?: ManagedWorkerRef
  clientsFor: ClientsFor
  linkFor: (serverId: string) => JobworkerpServerLink | undefined
  keepObsolete: boolean
  save: (target: StoredTarget) => Promise<T>
}

/**
 * Saves a setting with its execution target (spec §4.6.4): an inline
 * definition is stored in jobworkerp first and rolled back if the setting
 * cannot be saved; afterwards the managed worker the save left unused is
 * deleted unless the user keeps it.
 */
export async function saveSettingWithTarget<T>(
  input: SaveSettingInput<T>,
): Promise<{ saved: T } & CleanupResult> {
  const { form } = input
  const target = toStoredTarget(form)
  const current = managedWorkerOf(form, input.linkFor(form.serverId))
  const saved = current
    ? await saveWithManagedWorkflow(
        requireClients(input.clientsFor, form.serverId),
        {
          name: current.workerName,
          kind: input.kind,
          settingName: input.settingName,
          definition: form.definition,
          channel: form.channel,
        },
        () => input.save(target),
      )
    : await input.save(target)
  const obsolete = obsoleteManagedWorker(input.previous, current)
  return { saved, ...(await cleanUp(obsolete, input.clientsFor, input.keepObsolete)) }
}

export interface DeleteSettingInput {
  managed: ManagedWorkerRef | undefined
  clientsFor: ClientsFor
  keepObsolete: boolean
  remove: () => Promise<void>
}

/** Deletes a setting, then the managed worker it used unless the user keeps it. */
export async function deleteSettingWithTarget(input: DeleteSettingInput): Promise<CleanupResult> {
  await input.remove()
  return cleanUp(input.managed, input.clientsFor, input.keepObsolete)
}
