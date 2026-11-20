// Requires two running jobworkerp instances and conductor with gRPC-Web enabled:
//   bash scripts/test-env.sh up
import { afterEach, describe, expect, it } from "vitest"
import { createJobworkerpClients, type JobworkerpClients } from "@/lib/clients"
import { AppError, classifyError } from "@/lib/errors"
import { WORKFLOW_TEMPLATE } from "@/lib/execution-target/definition"
import { TEST_JOBWORKERP2_URL, TEST_JOBWORKERP_URL } from "@/test/endpoints"
import { uniqueName } from "@/test/names"
import { deleteWorkerByName } from "@/test/workers"
import { WORKFLOW_RUNNER_NAME } from "@/lib/execution-target/workflow-settings"
import { findRunnerByName, searchWorkers } from "./jobworkerp"
import {
  deleteManagedWorkflow,
  loadManagedWorkflow,
  saveManagedWorkflow,
  saveWithManagedWorkflow,
  type ManagedWorkflowInput,
} from "./managed-workflows"

const jw1 = createJobworkerpClients(TEST_JOBWORKERP_URL)
const jw2 = createJobworkerpClients(TEST_JOBWORKERP2_URL)
// Configured by scripts/test-env.sh besides the default channel.
const EXTRA_CHANNEL = "batch"

const cleanups: (() => Promise<unknown>)[] = []
afterEach(async () => {
  for (const cleanup of cleanups.splice(0).reverse()) await cleanup().catch(() => {})
})

function input(overrides: Partial<ManagedWorkflowInput> = {}): ManagedWorkflowInput {
  const name = uniqueName("it-wf", "w")
  return {
    name,
    kind: "schedule",
    settingName: name,
    definition: WORKFLOW_TEMPLATE,
    channel: "",
    ...overrides,
  }
}

function track(c: JobworkerpClients, name: string) {
  cleanups.push(() => deleteWorkerByName(c, name))
}

async function definitionOf(c: JobworkerpClients, name: string) {
  const found = await loadManagedWorkflow(c, name)
  return found.status === "found" ? found.definition : found.status
}

describe("managed workflow workers", () => {
  it("creates a WORKFLOW worker with the definition and conductor's workflow options", async () => {
    const wf = input({ channel: EXTRA_CHANNEL })
    track(jw1, wf.name)
    const change = await saveManagedWorkflow(jw1, wf)
    expect(change.created).toBe(true)
    expect(await loadManagedWorkflow(jw1, wf.name)).toMatchObject({
      status: "found",
      definition: WORKFLOW_TEMPLATE,
      channel: EXTRA_CHANNEL,
    })
    const data = (await jw1.worker.findByName({ name: wf.name })).data!.data!
    const runner = await findRunnerByName(jw1, WORKFLOW_RUNNER_NAME)
    expect(data).toMatchObject({
      runnerId: runner!.id,
      storeSuccess: false,
      storeFailure: true,
      broadcastResults: true,
      useStatic: false,
    })
  })

  it("updates the definition of an existing managed worker", async () => {
    const wf = input()
    track(jw1, wf.name)
    await saveManagedWorkflow(jw1, wf)
    const change = await saveManagedWorkflow(jw1, { ...wf, definition: "do: []\n" })
    expect(change.created).toBe(false)
    expect(await definitionOf(jw1, wf.name)).toBe("do: []\n")
  })

  it("refuses a name taken by a worker it does not manage, leaving that worker alone", async () => {
    const wf = input()
    track(jw1, wf.name)
    const runner = (await findRunnerByName(jw1, WORKFLOW_RUNNER_NAME))!
    await jw1.worker.create({
      name: wf.name,
      description: "made by hand",
      runnerId: runner.id,
      runnerSettings: new Uint8Array(),
      periodicInterval: 0,
      queueType: 0,
      responseType: 1,
      storeSuccess: false,
      storeFailure: false,
      useStatic: false,
      broadcastResults: false,
    })
    const error = await saveManagedWorkflow(jw1, wf).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(AppError)
    expect(classifyError(error).messageKey).toBe("executionTarget.errors.nameTaken")
    expect(await loadManagedWorkflow(jw1, wf.name)).toEqual({ status: "notManaged" })
  })

  it("passes on jobworkerp's rejection, such as an unknown channel", async () => {
    const wf = input({ channel: "no-such-channel" })
    track(jw1, wf.name)
    const error = classifyError(await saveManagedWorkflow(jw1, wf).catch((e: unknown) => e))
    expect(error.messageKey).toBe("errors.status.invalid_argument")
    expect(error.serverMessage).toContain("no-such-channel")
  })

  it("reports a missing worker", async () => {
    expect(await loadManagedWorkflow(jw1, uniqueName("it-wf", "missing"))).toEqual({
      status: "missing",
    })
  })

  describe("saving together with the conductor setting", () => {
    it("deletes a worker it created when the setting cannot be saved", async () => {
      const wf = input()
      track(jw1, wf.name)
      const failure = new Error("conductor refused")
      await expect(saveWithManagedWorkflow(jw1, wf, () => Promise.reject(failure))).rejects.toBe(
        failure,
      )
      expect(await loadManagedWorkflow(jw1, wf.name)).toEqual({ status: "missing" })
    })

    it("restores the previous definition when the setting cannot be saved", async () => {
      const wf = input()
      track(jw1, wf.name)
      await saveManagedWorkflow(jw1, wf)
      await expect(
        saveWithManagedWorkflow(jw1, { ...wf, definition: "do: []\n" }, () =>
          Promise.reject(new Error("conductor refused")),
        ),
      ).rejects.toThrow("conductor refused")
      expect(await definitionOf(jw1, wf.name)).toBe(WORKFLOW_TEMPLATE)
    })

    it("says so, naming the worker, when the rollback fails too", async () => {
      const wf = input()
      track(jw1, wf.name)
      await saveManagedWorkflow(jw1, wf)
      const error = await saveWithManagedWorkflow(
        jw1,
        { ...wf, definition: "do: []\n" },
        async () => {
          // The worker disappears before the rollback can restore it.
          await deleteWorkerByName(jw1, wf.name)
          throw new Error("conductor refused")
        },
      ).catch((e: unknown) => e)
      expect(classifyError(error)).toMatchObject({
        kind: "app",
        messageKey: "executionTarget.errors.rollbackFailed",
        messageValues: { name: wf.name },
      })
    })

    it("returns what the setting save returned", async () => {
      const wf = input()
      track(jw1, wf.name)
      await expect(saveWithManagedWorkflow(jw1, wf, async () => "saved")).resolves.toBe("saved")
    })
  })

  describe("deleting", () => {
    it("deletes a managed worker", async () => {
      const wf = input()
      track(jw1, wf.name)
      await saveManagedWorkflow(jw1, wf)
      expect(await deleteManagedWorkflow(jw1, wf.name)).toBe("deleted")
      expect(await loadManagedWorkflow(jw1, wf.name)).toEqual({ status: "missing" })
    })

    it("leaves workers it does not manage and tolerates missing ones", async () => {
      expect(await deleteManagedWorkflow(jw1, uniqueName("it-wf", "missing"))).toBe("missing")
      // conductor's bootstrap registers its own "conductor_" workers in the
      // all-in-one image; other tests may be creating managed workers meanwhile.
      const [foreign] = await searchWorkers(jw1, "conductor_", { limit: 1 })
      expect(foreign).toBeDefined()
      const name = foreign.data!.name
      expect(await deleteManagedWorkflow(jw1, name)).toBe("notManaged")
      expect((await jw1.worker.findByName({ name })).data).toBeDefined()
    })

    it("moves a worker to another jobworkerp by saving there and deleting here", async () => {
      const wf = input()
      track(jw1, wf.name)
      track(jw2, wf.name)
      await saveManagedWorkflow(jw1, wf)
      await saveManagedWorkflow(jw2, wf)
      expect(await deleteManagedWorkflow(jw1, wf.name)).toBe("deleted")
      expect(await definitionOf(jw1, wf.name)).toBe("missing")
      expect(await definitionOf(jw2, wf.name)).toBe(WORKFLOW_TEMPLATE)
    })
  })
})
