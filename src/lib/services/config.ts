import type { CallOptions } from "nice-grpc-common"
import type { ConductorClients } from "@/lib/clients"
import { findEntity, toEntities, type Entity } from "@/lib/entities"
import { toEpochSeconds } from "@/lib/format"
import type { CronSchedulerData } from "@/lib/grpc/jobworkerp_conductor/data/cron_scheduler"
import type { JobworkerpServerData } from "@/lib/grpc/jobworkerp_conductor/data/jobworkerp_server"
import type { SlackEventHandlerData } from "@/lib/grpc/jobworkerp_conductor/data/slack_event_handler"
import type { WorkerResultHandlerData } from "@/lib/grpc/jobworkerp_conductor/data/worker_result_handler"
import { collect, notFound } from "./common"

/** The configuration entities managed through conductor's admin API. */
export interface ConfigDataByKind {
  servers: JobworkerpServerData
  schedules: CronSchedulerData
  slackHandlers: SlackEventHandlerData
  resultHandlers: WorkerResultHandlerData
}
export type ConfigEntityKind = keyof ConfigDataByKind
export type ConfigEntity<K extends ConfigEntityKind> = Entity<ConfigDataByKind[K]>

// The four admin services share these RPC shapes; only the message types differ.
interface ConfigClient<D> {
  findList(
    request: object,
    options?: CallOptions,
  ): AsyncIterable<{ id?: { value: string }; data?: D }>
  create(request: D): Promise<{ id?: { value: string } }>
  update(request: { id: { value: string }; data: D }): Promise<{ isSuccess: boolean }>
  delete(request: { value: string }): Promise<{ isSuccess: boolean }>
}

const SERVICES: Record<ConfigEntityKind, { client: keyof ConductorClients; path: string }> = {
  servers: {
    client: "jobworkerpServer",
    path: "jobworkerp_conductor.service.JobworkerpServerService",
  },
  schedules: { client: "cronScheduler", path: "jobworkerp_conductor.service.CronSchedulerService" },
  slackHandlers: {
    client: "slackEventHandler",
    path: "jobworkerp_conductor.service.SlackEventHandlerService",
  },
  resultHandlers: {
    client: "workerResultHandler",
    path: "jobworkerp_conductor.service.WorkerResultHandlerService",
  },
}

function clientOf<K extends ConfigEntityKind>(
  c: ConductorClients,
  kind: K,
): ConfigClient<ConfigDataByKind[K]> {
  return c[SERVICES[kind].client] as unknown as ConfigClient<ConfigDataByKind[K]>
}

const missing = (kind: ConfigEntityKind, method: string, id: string) =>
  notFound(`/${SERVICES[kind].path}/${method}`, `${kind} ${id}`)

// FindList, unlike Find/FindByName, bypasses conductor's memory cache, which
// is not invalidated on update or delete (conductor #84). Every read here
// therefore goes through the full list.
export async function listConfig<K extends ConfigEntityKind>(
  c: ConductorClients,
  kind: K,
  signal?: AbortSignal,
): Promise<ConfigEntity<K>[]> {
  return toEntities(await collect(clientOf(c, kind).findList({}, { signal })))
}

export async function createConfig<K extends ConfigEntityKind>(
  c: ConductorClients,
  kind: K,
  data: ConfigDataByKind[K],
): Promise<string> {
  const response = await clientOf(c, kind).create(data)
  if (!response.id) throw new Error(`conductor returned no id for the new ${kind} entry`)
  return response.id.value
}

/**
 * conductor answers success for an Update of a missing id (conductor #86), so
 * writes are preceded by this check; a delete racing in between still slips by.
 */
async function requireConfig<K extends ConfigEntityKind>(
  c: ConductorClients,
  kind: K,
  id: string,
): Promise<ConfigDataByKind[K]> {
  const entity = findEntity(await listConfig(c, kind), id)
  if (!entity) throw missing(kind, "Update", id)
  return entity.data
}

async function writeConfig<K extends ConfigEntityKind>(
  c: ConductorClients,
  kind: K,
  id: string,
  data: ConfigDataByKind[K],
) {
  const response = await clientOf(c, kind).update({ id: { value: id }, data })
  if (!response.isSuccess) throw missing(kind, "Update", id)
}

export async function updateConfig<K extends ConfigEntityKind>(
  c: ConductorClients,
  kind: K,
  id: string,
  data: ConfigDataByKind[K],
) {
  await requireConfig(c, kind, id)
  await writeConfig(c, kind, id, data)
}

/**
 * Update replaces every field and has no optimistic lock, so the toggle starts
 * from the latest stored values rather than what the screen loaded (spec §4.3).
 */
export async function setConfigEnabled<K extends ConfigEntityKind>(
  c: ConductorClients,
  kind: K,
  id: string,
  enabled: boolean,
  nowSeconds: number,
) {
  const latest = await requireConfig(c, kind, id)
  await writeConfig(c, kind, id, { ...latest, enabled, updatedAt: toEpochSeconds(nowSeconds) })
}

export async function deleteConfig(c: ConductorClients, kind: ConfigEntityKind, id: string) {
  const response = await clientOf(c, kind).delete({ value: id })
  if (!response.isSuccess) throw missing(kind, "Delete", id)
}
