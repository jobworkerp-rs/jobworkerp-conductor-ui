import { ClientError } from "nice-grpc-common"
import type { JobworkerpClients } from "@/lib/clients"
import { AppError } from "@/lib/errors"
import {
  isManagedWorker,
  managedWorkerData,
  managedWorkerDescription,
} from "@/lib/execution-target/managed-worker"
import type { ConfigKind } from "@/lib/execution-target/form"
import {
  WORKFLOW_RUNNER_NAME,
  decodeWorkflowSettings,
  encodeWorkflowSettings,
} from "@/lib/execution-target/workflow-settings"
import type { WorkerData } from "@/lib/grpc/jobworkerp/data/worker"
import { findRunnerByName, findWorkerByName } from "./jobworkerp"

export interface ManagedWorkflowInput {
  name: string
  kind: ConfigKind
  settingName: string
  definition: string
  channel: string
}

export type ManagedWorkflowLookup =
  | { status: "missing" }
  | { status: "notManaged" }
  | { status: "found"; definition: string; channel: string }

/** What a save changed, so it can be undone if the conductor setting fails to save. */
export interface ManagedWorkflowChange {
  name: string
  workerId: string
  created: boolean
  previous?: WorkerData
}

/** The WORKFLOW runner's id and settings schema. */
async function workflowRunner(
  c: JobworkerpClients,
  signal?: AbortSignal,
): Promise<{ id: string; settingsProto: string }> {
  const runner = await findRunnerByName(c, WORKFLOW_RUNNER_NAME, signal)
  if (!runner?.id || !runner.data) throw new AppError("executionTarget.errors.noWorkflowRunner")
  return { id: runner.id.value, settingsProto: runner.data.runnerSettingsProto }
}

/** Reads an inline workflow back; jobworkerp is the source of truth (spec §4.6.4). */
export async function loadManagedWorkflow(
  c: JobworkerpClients,
  name: string,
  signal?: AbortSignal,
): Promise<ManagedWorkflowLookup> {
  const [worker, runner] = await Promise.all([
    findWorkerByName(c, name, signal),
    workflowRunner(c, signal),
  ])
  if (!worker?.data) return { status: "missing" }
  if (!isManagedWorker(worker.data) || worker.data.runnerId?.value !== runner.id) {
    return { status: "notManaged" }
  }
  const settings = decodeWorkflowSettings(runner.settingsProto, worker.data.runnerSettings)
  if (settings.workflowData === undefined) return { status: "notManaged" }
  return { status: "found", definition: settings.workflowData, channel: worker.data.channel ?? "" }
}

/** Registers or updates the WORKFLOW worker that stores an inline definition. */
export async function saveManagedWorkflow(
  c: JobworkerpClients,
  input: ManagedWorkflowInput,
): Promise<ManagedWorkflowChange> {
  const [runner, existing] = await Promise.all([workflowRunner(c), findWorkerByName(c, input.name)])
  if (existing?.data && !isManagedWorker(existing.data)) {
    throw new AppError("executionTarget.errors.nameTaken", { name: input.name })
  }
  const data = managedWorkerData({
    name: input.name,
    description: managedWorkerDescription(input.kind, input.settingName),
    runnerId: runner.id,
    runnerSettings: encodeWorkflowSettings(runner.settingsProto, input.definition),
    channel: input.channel,
  })
  if (existing?.id && existing.data) {
    await c.worker.update({ id: existing.id, data })
    return {
      name: input.name,
      workerId: existing.id.value,
      created: false,
      previous: existing.data,
    }
  }
  const created = await c.worker.create(data)
  if (!created.id) throw new Error("jobworkerp returned no id for the new worker")
  return { name: input.name, workerId: created.id.value, created: true }
}

async function undoManagedWorkflow(c: JobworkerpClients, change: ManagedWorkflowChange) {
  if (change.created) {
    // Already gone counts as undone.
    await c.worker.delete({ value: change.workerId })
    return
  }
  // jobworkerp answers success for an Update of a missing worker (jobworkerp-rs
  // #453), so a worker deleted in the meantime is detected here instead.
  const current = await findWorkerByName(c, change.name)
  if (current?.id?.value !== change.workerId) {
    throw new Error(`worker ${change.name} no longer exists`)
  }
  const response = await c.worker.update({ id: { value: change.workerId }, data: change.previous })
  if (!response.isSuccess) throw new Error(`worker ${change.name} could not be restored`)
}

/**
 * Saves the worker first, then the conductor setting through `save`; if that
 * fails, the worker goes back to how it was (spec §4.6.4).
 */
export async function saveWithManagedWorkflow<T>(
  c: JobworkerpClients,
  input: ManagedWorkflowInput,
  save: () => Promise<T>,
): Promise<T> {
  const change = await saveManagedWorkflow(c, input)
  try {
    return await save()
  } catch (err) {
    try {
      await undoManagedWorkflow(c, change)
    } catch {
      throw new AppError("executionTarget.errors.rollbackFailed", { name: change.name }, err)
    }
    throw err
  }
}

/** Deletes a managed worker; workers the UI does not manage are never touched. */
export async function deleteManagedWorkflow(
  c: JobworkerpClients,
  name: string,
): Promise<"deleted" | "missing" | "notManaged"> {
  const worker = await findWorkerByName(c, name)
  if (!worker?.id || !worker.data) return "missing"
  if (!isManagedWorker(worker.data)) return "notManaged"
  await c.worker.delete(worker.id)
  return "deleted"
}

/** Whether jobworkerp refused to save the managed worker itself (shown under the definition). */
export function isWorkerSaveError(err: unknown): err is ClientError {
  return err instanceof ClientError && err.path.startsWith("/jobworkerp.service.WorkerService/")
}
