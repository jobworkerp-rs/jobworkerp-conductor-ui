import type { JobworkerpClients } from "@/lib/clients"
import { QueueType, ResponseType } from "@/lib/grpc/jobworkerp/data/common"
import { findRunnerByName, findWorkerByName } from "@/lib/services/jobworkerp"

/** Test cleanup: removes a worker by name if it exists, whoever manages it. */
export async function deleteWorkerByName(c: JobworkerpClients, name: string) {
  const worker = await findWorkerByName(c, name)
  if (worker?.id) await c.worker.delete(worker.id)
}

/**
 * A COMMAND worker whose jobs run `sleep`, for executions that stay running
 * long enough to watch and cancel. Results come back directly, as for the
 * workers conductor creates, so conductor follows the job to its end.
 */
export async function createSleepWorker(c: JobworkerpClients, name: string): Promise<void> {
  const runner = await findRunnerByName(c, "COMMAND")
  if (!runner?.id) throw new Error("the test jobworkerp has no COMMAND runner")
  await c.worker.create({
    name,
    description: "conductor UI test: sleeps",
    runnerId: runner.id,
    runnerSettings: new Uint8Array(0),
    periodicInterval: 0,
    queueType: QueueType.NORMAL,
    responseType: ResponseType.DIRECT,
    storeSuccess: true,
    storeFailure: true,
    useStatic: false,
    broadcastResults: true,
  })
}

/** Args for a COMMAND job that sleeps for the given seconds. */
export const sleepArgs = (seconds: number) =>
  JSON.stringify({ command: "sleep", args: [String(seconds)] })
