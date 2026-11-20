import type { CallOptions } from "nice-grpc-common"
import type { JobResult } from "@/lib/grpc/jobworkerp/data/job_result"
import type { JobworkerpClients } from "@/lib/clients"
import type { Runner } from "@/lib/grpc/jobworkerp/data/runner"
import { WorkerSortField, type Worker } from "@/lib/grpc/jobworkerp/data/worker"
import { summarizeJobStatuses, type JobStatusSummary } from "@/lib/jobworkerp-status"
import { collect } from "./common"

export interface JobworkerpInfo {
  workerCount: number
  channels: { name: string; workerCount: number }[]
  jobs: JobStatusSummary
}

/**
 * Job counts come from FindAll like the admin-ui dashboard: CountByCondition
 * needs JOB_STATUS_RDB_INDEXING on the server, which cannot be assumed.
 */
export async function fetchJobworkerpInfo(
  c: JobworkerpClients,
  signal?: AbortSignal,
): Promise<JobworkerpInfo> {
  const options = { signal }
  const [count, channelList, statuses] = await Promise.all([
    c.worker.count({}, options),
    c.worker.findChannelList({}, options),
    collect(c.jobProcessingStatus.findAll({}, options)),
  ])
  return {
    workerCount: Number(count.total),
    channels: channelList.channels.map((channel) => ({
      name: channel.name,
      workerCount: Number(channel.workerCount),
    })),
    jobs: summarizeJobStatuses(statuses.map((s) => s.status)),
  }
}

export const WORKER_SEARCH_LIMIT = 20

// How many workers to scan when the prefix has to be narrowed down here.
const WIDENED_SEARCH_LIMIT = 500

/**
 * On SQLite, jobworkerp's prefix filter matches nothing once it contains "_"
 * or "%" (jobworkerp-rs #454), so the server is asked for the part before
 * them and the match is finished here. Callers cache by `serverPrefix`.
 */
export function planWorkerSearch(prefix: string): { serverPrefix: string; widened: boolean } {
  const serverPrefix = prefix.split(/[_%]/)[0]
  return { serverPrefix, widened: serverPrefix !== prefix }
}

export function fetchWorkerCandidates(
  c: JobworkerpClients,
  plan: { serverPrefix: string; widened: boolean },
  options: { limit?: number; signal?: AbortSignal } = {},
): Promise<Worker[]> {
  return collect(
    c.worker.findList(
      {
        runnerTypes: [],
        runnerIds: [],
        nameFilter: plan.serverPrefix === "" ? undefined : plan.serverPrefix,
        limit: plan.widened ? WIDENED_SEARCH_LIMIT : (options.limit ?? WORKER_SEARCH_LIMIT),
        sortBy: WorkerSortField.WORKER_SORT_FIELD_NAME,
        ascending: true,
      },
      { signal: options.signal },
    ),
  )
}

export function narrowWorkers(workers: Worker[], prefix: string, limit = WORKER_SEARCH_LIMIT) {
  return workers.filter((w) => w.data?.name.startsWith(prefix)).slice(0, limit)
}

/** Worker candidates whose name starts with `prefix`, sorted by name. */
export async function searchWorkers(
  c: JobworkerpClients,
  prefix: string,
  options: { limit?: number; signal?: AbortSignal } = {},
): Promise<Worker[]> {
  const plan = planWorkerSearch(prefix)
  const workers = await fetchWorkerCandidates(c, plan, options)
  return plan.widened ? narrowWorkers(workers, prefix, options.limit) : workers
}

export async function findRunnerByName(
  c: JobworkerpClients,
  name: string,
  signal?: AbortSignal,
): Promise<Runner | undefined> {
  return (await c.runner.findByName({ name }, { signal })).data
}

export async function findWorkerByName(
  c: JobworkerpClients,
  name: string,
  signal?: AbortSignal,
): Promise<Worker | undefined> {
  return (await c.worker.findByName({ name }, { signal })).data
}

export async function findRunner(
  c: JobworkerpClients,
  id: string,
  signal?: AbortSignal,
): Promise<Runner | undefined> {
  return (await c.runner.find({ value: id }, { signal })).data
}

// How FindChannelList names the default channel; a worker on it has no channel set.
const DEFAULT_CHANNEL_LABEL = "[default]"

/**
 * Named job channels configured in jobworkerp; a worker on any other channel
 * is refused. The default channel is left out: it is chosen by leaving the
 * channel empty.
 */
export async function listChannels(c: JobworkerpClients, signal?: AbortSignal): Promise<string[]> {
  const { channels } = await c.worker.findChannelList({}, { signal })
  return channels.map((channel) => channel.name).filter((name) => name !== DEFAULT_CHANNEL_LABEL)
}

/** The result jobworkerp stored for a job, if it keeps one. */
export async function findJobResult(
  jw: JobworkerpClients,
  jobId: string,
  options?: CallOptions,
): Promise<JobResult | undefined> {
  const [first] = await collect(jw.jobResult.findListByJobId({ jobId: { value: jobId } }, options))
  return first
}
