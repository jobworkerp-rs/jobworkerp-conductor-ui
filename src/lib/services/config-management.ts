import type { ConductorClients, JobworkerpClients } from "@/lib/clients"
import { AppError } from "@/lib/errors"
import type { ImportTomlResponse } from "@/lib/grpc/jobworkerp_conductor/service/config_management"
import { deleteManagedWorkflow } from "./managed-workflows"

/** Per kind, what an import creates (or, validated, would create). */
export interface ImportCounts {
  servers: number
  schedules: number
  resultHandlers: number
  slackHandlers: number
}

/** `ok` only when every entry can be imported; otherwise nothing is written. */
export interface ImportResult {
  ok: boolean
  counts: ImportCounts
  errors: string[]
}

function toResult(response: ImportTomlResponse): ImportResult {
  return {
    ok: response.isSuccess,
    counts: {
      servers: response.importedServers,
      schedules: response.importedSchedulers,
      resultHandlers: response.importedListeners,
      slackHandlers: response.importedSlackHandlers,
    },
    errors: response.validationErrors,
  }
}

/**
 * Every setting (or only the enabled ones) as a TOML file. `leftOut` names
 * the settings the file cannot hold, as the server they run on is gone.
 */
export async function exportConfig(
  c: ConductorClients,
  enabledOnly: boolean,
): Promise<{ toml: string; leftOut: string[] }> {
  const response = await c.configManagement.exportToml({ enabledOnly })
  if (!response.isSuccess) {
    throw new AppError("settingsPage.export.failed", { message: response.message })
  }
  return { toml: response.tomlContent, leftOut: response.leftOut }
}

const importRequest = (toml: string, overwrite: boolean, validateOnly: boolean) => ({
  tomlContent: toml,
  overwriteExisting: overwrite,
  validateOnly,
})

/** A dry run: conductor imports and rolls back, so the result is a real run's. */
export async function validateConfig(
  c: ConductorClients,
  toml: string,
  overwrite: boolean,
): Promise<ImportResult> {
  return toResult(await c.configManagement.validateConfig(importRequest(toml, overwrite, true)))
}

/** Imports the file; with `overwrite`, every setting is deleted first. */
export async function importConfig(
  c: ConductorClients,
  toml: string,
  overwrite: boolean,
): Promise<ImportResult> {
  return toResult(await c.configManagement.importToml(importRequest(toml, overwrite, false)))
}

/** A managed workflow worker to remove with the settings that used it. */
export interface WorkerToDelete {
  clients: JobworkerpClients
  workerName: string
}

/**
 * Deletes every setting, then the given managed workers, whose definitions
 * are of no use without them. Execution history stays. The workers that
 * could not be deleted are returned by name, as the settings are gone by then.
 */
export async function clearAllSettings(
  c: ConductorClients,
  workers: readonly WorkerToDelete[],
): Promise<{ failedWorkers: string[] }> {
  await c.configManagement.clearAllConfigs({})
  const results = await Promise.allSettled(
    workers.map((w) => deleteManagedWorkflow(w.clients, w.workerName)),
  )
  return {
    failedWorkers: workers
      .filter((_, i) => results[i]?.status === "rejected")
      .map((w) => w.workerName),
  }
}
