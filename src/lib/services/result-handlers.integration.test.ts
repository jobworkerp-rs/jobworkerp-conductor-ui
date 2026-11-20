// Requires a running conductor and jobworkerp with gRPC-Web enabled:
//   bash scripts/test-env.sh up
import * as protobuf from "protobufjs"
import { afterEach, describe, expect, it } from "vitest"
import { createConductorClients, createJobworkerpClients } from "@/lib/clients"
import { findEntity } from "@/lib/entities"
import { WORKFLOW_TEMPLATE } from "@/lib/execution-target/definition"
import { EXECUTION_TARGET_DEFAULTS } from "@/lib/execution-target/form"
import { WORKFLOW_RUNNER_NAME, findMessageType } from "@/lib/execution-target/workflow-settings"
import { nowSeconds } from "@/lib/format"
import type { JobResult } from "@/lib/grpc/jobworkerp/data/job_result"
import {
  RESULT_HANDLER_FORM_DEFAULTS,
  toResultHandlerData,
  type ResultHandlerFormValues,
} from "@/lib/result-handlers/form"
import { TEST_CONDUCTOR_URL, TEST_JOBWORKERP_URL } from "@/test/endpoints"
import { uniqueName } from "@/test/names"
import { localServerId } from "@/test/servers"
import { deleteWorkerByName } from "@/test/workers"
import { createConfig, deleteConfig, listConfig, setConfigEnabled, updateConfig } from "./config"
import { findRunnerByName } from "./jobworkerp"
import { saveManagedWorkflow } from "./managed-workflows"

const conductor = createConductorClients(TEST_CONDUCTOR_URL)
const jw = createJobworkerpClients(TEST_JOBWORKERP_URL)
const cleanups: (() => Promise<unknown>)[] = []
afterEach(async () => {
  for (const cleanup of cleanups.splice(0).reverse()) await cleanup().catch(() => {})
})

async function createHandler(values: ResultHandlerFormValues) {
  const id = await createConfig(
    conductor,
    "resultHandlers",
    toResultHandlerData(values, nowSeconds()),
  )
  cleanups.push(() => deleteConfig(conductor, "resultHandlers", id))
  return id
}

async function managedWorkflow(label: string, definition = WORKFLOW_TEMPLATE) {
  const name = uniqueName("it-rh", label)
  await saveManagedWorkflow(jw, {
    name,
    kind: "resultHandler",
    settingName: name,
    definition,
    channel: "",
  })
  cleanups.push(() => deleteWorkerByName(jw, name))
  return name
}

/** WorkflowRunArgs codec from the runner's own schema for "run". */
async function runArgsType() {
  const runner = await findRunnerByName(jw, WORKFLOW_RUNNER_NAME)
  const argsProto = runner!.data!.methodProtoMap!.schemas.run.argsProto
  return findMessageType(protobuf.parse(argsProto).root, "WorkflowRunArgs")!
}

/** The next result of `worker` within `timeoutMs`, or undefined. */
function nextResult(worker: string, timeoutMs: number): Promise<JobResult | undefined> {
  const controller = new AbortController()
  const results = jw.jobResult.listenByWorker({ workerName: worker }, { signal: controller.signal })
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  return (async () => {
    try {
      for await (const result of results) return result
    } catch {
      // Aborted at the deadline.
    } finally {
      clearTimeout(timer)
    }
    return undefined
  })()
}

async function runWorkflow(worker: string, input: unknown) {
  const type = await runArgsType()
  await jw.job.enqueue({
    workerName: worker,
    args: type.encode(type.create({ input: JSON.stringify(input) })).finish(),
    using: "run",
  })
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 300))

describe("result handlers", () => {
  it("creates, updates, toggles and deletes a handler", async () => {
    const serverId = await localServerId(conductor)
    const values: ResultHandlerFormValues = {
      ...RESULT_HANDLER_FORM_DEFAULTS,
      name: uniqueName("it-rh", "crud"),
      listenServerId: serverId,
      listenWorkerName: "watched",
      enabled: false,
      target: { ...EXECUTION_TARGET_DEFAULTS, serverId, method: "worker", workerName: "follow-up" },
    }
    const id = await createHandler(values)
    const stored = async () => findEntity(await listConfig(conductor, "resultHandlers"), id)?.data
    expect(await stored()).toMatchObject({
      name: values.name,
      listenWorkerName: "watched",
      worker: { workerName: "follow-up" },
      enabled: false,
    })

    const updated = toResultHandlerData(
      {
        ...values,
        description: "changed",
        target: { ...values.target, method: "workflowUrl", workflowUrl: "https://h/f.yaml" },
      },
      nowSeconds(),
    )
    await updateConfig(conductor, "resultHandlers", id, updated)
    expect(await stored()).toMatchObject({
      description: "changed",
      workflow: { workflowUrl: "https://h/f.yaml" },
    })
    expect((await stored())?.worker).toBeUndefined()

    await setConfigEnabled(conductor, "resultHandlers", id, true, nowSeconds())
    expect((await stored())?.enabled).toBe(true)

    await deleteConfig(conductor, "resultHandlers", id)
    expect(await stored()).toBeUndefined()
  })

  it("runs the follow-up with the watched result and the args, and not after a failure", async () => {
    const serverId = await localServerId(conductor)
    const watched = await managedWorkflow("watched")
    const followUp = await managedWorkflow("follow-up")
    await createHandler({
      ...RESULT_HANDLER_FORM_DEFAULTS,
      name: uniqueName("it-rh", "path"),
      listenServerId: serverId,
      listenWorkerName: watched,
      target: {
        ...EXECUTION_TARGET_DEFAULTS,
        serverId,
        method: "workflowInline",
        managedWorkerName: followUp,
        args: '{"tag":"x"}',
      },
    })

    // conductor loads new handlers asynchronously; run the watched worker
    // until the follow-up answers, within a bounded number of attempts.
    let followed: JobResult | undefined
    for (let attempt = 0; attempt < 10 && !followed; attempt++) {
      const result = nextResult(followUp, 3_000)
      await settle()
      await runWorkflow(watched, { attempt })
      followed = await result
    }
    expect(followed).toBeDefined()
    const type = await runArgsType()
    const runArgs = type.toObject(type.decode(followed!.data!.args)) as { input: string }
    const input = JSON.parse(runArgs.input) as { result: unknown; args: unknown }
    expect(input.args).toEqual({ tag: "x" })
    expect(input.result).toBeTruthy()

    // A failed watched job must not start the follow-up.
    await saveManagedWorkflow(jw, {
      name: watched,
      kind: "resultHandler",
      settingName: watched,
      definition: 'do:\n  - fail:\n      set:\n        x: "${ error(\\"boom\\") }"\n',
      channel: "",
    })
    const after = nextResult(followUp, 5_000)
    await settle()
    await runWorkflow(watched, { attempt: "fail" })
    expect(await after).toBeUndefined()
  }, 60_000)
})
