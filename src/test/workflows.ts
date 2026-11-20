import * as protobuf from "protobufjs"
import type { JobworkerpClients } from "@/lib/clients"
import { WORKFLOW_RUNNER_NAME, findMessageType } from "@/lib/execution-target/workflow-settings"
import { findRunnerByName } from "@/lib/services/jobworkerp"

/**
 * Runs `start` and returns the input the next job of the WORKFLOW worker
 * `workerName` received, decoded with the runner's own schema for "run".
 */
export async function nextWorkflowInput(
  jw: JobworkerpClients,
  workerName: string,
  start: () => Promise<unknown>,
): Promise<unknown> {
  const results = jw.jobResult.listenByWorker({ workerName })[Symbol.asyncIterator]()
  const next = results.next()
  // Let the listener subscribe before the job runs; results are not replayed.
  await new Promise((resolve) => setTimeout(resolve, 500))
  await start()
  const { value: result } = await next
  void results.return?.()

  const runner = await findRunnerByName(jw, WORKFLOW_RUNNER_NAME)
  const argsProto = runner!.data!.methodProtoMap!.schemas.run.argsProto
  const type = findMessageType(protobuf.parse(argsProto).root, "WorkflowRunArgs")!
  const runArgs = type.toObject(type.decode(result.data!.args)) as { input?: string }
  return JSON.parse(runArgs.input!)
}
