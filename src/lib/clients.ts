import { createChannel, createClientFactory } from "nice-grpc-web"
import {
  JobProcessingStatusServiceDefinition,
  JobServiceDefinition,
} from "./grpc/jobworkerp/service/job"
import { JobResultServiceDefinition } from "./grpc/jobworkerp/service/job_result"
import { RunnerServiceDefinition } from "./grpc/jobworkerp/service/runner"
import { WorkerServiceDefinition } from "./grpc/jobworkerp/service/worker"
import { ConfigManagementServiceDefinition } from "./grpc/jobworkerp_conductor/service/config_management"
import { CronSchedulerServiceDefinition } from "./grpc/jobworkerp_conductor/service/cron_scheduler"
import { ExecutionStatusServiceDefinition } from "./grpc/jobworkerp_conductor/service/execution_status"
import { JobworkerpServerServiceDefinition } from "./grpc/jobworkerp_conductor/service/jobworkerp_server"
import { SlackEventHandlerServiceDefinition } from "./grpc/jobworkerp_conductor/service/slack_event_handler"
import { WorkerResultHandlerServiceDefinition } from "./grpc/jobworkerp_conductor/service/worker_result_handler"
import type { RuntimeConfig } from "./runtime-config"

const clientFactory = createClientFactory()

/** Clients for the conductor admin API at `baseUrl` (gRPC-Web). */
export function createConductorClients(baseUrl: string) {
  const channel = createChannel(baseUrl)
  return {
    cronScheduler: clientFactory.create(CronSchedulerServiceDefinition, channel),
    slackEventHandler: clientFactory.create(SlackEventHandlerServiceDefinition, channel),
    workerResultHandler: clientFactory.create(WorkerResultHandlerServiceDefinition, channel),
    jobworkerpServer: clientFactory.create(JobworkerpServerServiceDefinition, channel),
    executionStatus: clientFactory.create(ExecutionStatusServiceDefinition, channel),
    configManagement: clientFactory.create(ConfigManagementServiceDefinition, channel),
  }
}

/** Read-mostly clients for one jobworkerp server reachable from the browser. */
export function createJobworkerpClients(baseUrl: string) {
  const channel = createChannel(baseUrl)
  return {
    worker: clientFactory.create(WorkerServiceDefinition, channel),
    runner: clientFactory.create(RunnerServiceDefinition, channel),
    job: clientFactory.create(JobServiceDefinition, channel),
    jobResult: clientFactory.create(JobResultServiceDefinition, channel),
    jobProcessingStatus: clientFactory.create(JobProcessingStatusServiceDefinition, channel),
  }
}

export type ConductorClients = ReturnType<typeof createConductorClients>
export type JobworkerpClients = ReturnType<typeof createJobworkerpClients>

export interface RuntimeClients {
  conductor: ConductorClients
  /** Clients for the jobworkerp servers that have a browser-facing URL, by server name. */
  jobworkerp: ReadonlyMap<string, JobworkerpClients>
}

export function createRuntimeClients(config: RuntimeConfig): RuntimeClients {
  return {
    conductor: createConductorClients(config.conductorUrl),
    jobworkerp: new Map(
      config.jobworkerpServers.flatMap((server) =>
        server.grpcWebUrl
          ? [[server.name, createJobworkerpClients(server.grpcWebUrl)] as const]
          : [],
      ),
    ),
  }
}
