// Executions as conductor records them, driven through real schedules.
// Requires a running conductor and jobworkerp with gRPC-Web enabled:
//   bash scripts/test-env.sh up
import { Status } from "nice-grpc-common"
import { afterEach, describe, expect, it, vi } from "vitest"
import { createConductorClients, createJobworkerpClients } from "@/lib/clients"
import { classifyError } from "@/lib/errors"
import { toListQuery } from "@/lib/executions/filter"
import { nowSeconds } from "@/lib/format"
import { ResolvedExecutionStatus as S } from "@/lib/grpc/jobworkerp_conductor/data/execution_ref"
import { toScheduleData } from "@/lib/schedules/form"
import { TEST_CONDUCTOR_URL, TEST_JOBWORKERP_URL } from "@/test/endpoints"
import { uniqueName } from "@/test/names"
import { inertScheduleForm } from "@/test/schedules"
import { localServerId } from "@/test/servers"
import { createSleepWorker, deleteWorkerByName, sleepArgs } from "@/test/workers"
import { createConfig, deleteConfig } from "./config"
import {
  cancelExecution,
  deleteExecution,
  deleteExecutionsBySource,
  findExecution,
  findLatestStatusBySource,
  findRuntimeStatus,
  listExecutions,
  reExecute,
  triggerSchedule,
} from "./executions"

const conductor = createConductorClients(TEST_CONDUCTOR_URL)
const jw = createJobworkerpClients(TEST_JOBWORKERP_URL)
const cleanups: (() => Promise<unknown>)[] = []
afterEach(async () => {
  for (const cleanup of cleanups.splice(0).reverse()) await cleanup().catch(() => {})
})

/** A schedule of a worker that does not exist: each run is recorded and fails to enqueue. */
async function unqueuedSchedule() {
  const form = inertScheduleForm(uniqueName("it-exec", "s"), await localServerId(conductor), {
    workerName: uniqueName("it-exec", "missing"),
  })
  const id = await createConfig(conductor, "schedules", toScheduleData(form, nowSeconds()))
  cleanups.push(() => deleteExecutionsBySource(conductor, "schedule", id, true))
  cleanups.push(() => deleteConfig(conductor, "schedules", id))
  return id
}

/** A schedule whose runs sleep on a COMMAND worker, so they stay running a while. */
async function sleepingSchedule(seconds = 30) {
  const worker = uniqueName("it-exec", "sleep")
  await createSleepWorker(jw, worker)
  cleanups.push(() => deleteWorkerByName(jw, worker))
  const form = inertScheduleForm(uniqueName("it-exec", "s"), await localServerId(conductor), {
    workerName: worker,
    args: sleepArgs(seconds),
  })
  const id = await createConfig(conductor, "schedules", toScheduleData(form, nowSeconds()))
  cleanups.push(() => deleteExecutionsBySource(conductor, "schedule", id, true))
  cleanups.push(() => deleteConfig(conductor, "schedules", id))
  return id
}

async function run(scheduleId: string, argsJson?: string) {
  const outcome = await triggerSchedule(conductor, scheduleId, argsJson)
  return outcome.refId!
}

/** Waits until the run has a job and jobworkerp reports it running. */
const WAIT = { timeout: 20_000, interval: 300 }

const runningJob = (refId: string) =>
  vi.waitFor(async () => {
    const status = await findRuntimeStatus(conductor, refId)
    expect(status?.resolvedStatus).toBe(S.RESOLVED_EXECUTION_STATUS_RUNNING)
    expect(status?.executionRef?.jobId).toBeDefined()
    return status!
  }, WAIT)

const statusOf = async (refId: string) =>
  (await findRuntimeStatus(conductor, refId))?.resolvedStatus

describe("listing executions", () => {
  it("filters by kind, server and period on the server", async () => {
    const id = await unqueuedSchedule()
    const before = Math.floor(nowSeconds()) - 1
    const refId = await run(id)
    const ids = async (filter: Parameters<typeof toListQuery>[0]) =>
      (await listExecutions(conductor, toListQuery(filter, nowSeconds() + 1, 1, 100))).rows.map(
        (r) => r.id?.value,
      )
    const server = await localServerId(conductor)
    expect(await ids({ sourceType: "schedule", server, period: "1h" })).toContain(refId)
    expect(await ids({ sourceType: "slackHandler", period: "1h" })).not.toContain(refId)
    expect(await ids({ server: "999999999", period: "1h" })).not.toContain(refId)
    const later = new Date((before + 3600) * 1000)
    const local = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}T${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`
    expect(await ids({ period: "custom", from: local(later) })).not.toContain(refId)
  })

  it("pages one source's executions, newest first, telling whether more follow", async () => {
    const id = await unqueuedSchedule()
    // conductor orders by trigger second; runs within one second have no set order.
    const refs: string[] = []
    for (let i = 0; i < 3; i++) {
      if (i > 0) await new Promise((resolve) => setTimeout(resolve, 1100))
      refs.push(await run(id))
    }
    const page = (n: number) =>
      listExecutions(
        conductor,
        toListQuery({ sourceType: "schedule", sourceId: id, period: "all" }, 0, n, 2),
      )
    const first = await page(1)
    expect(first.rows.map((r) => r.id?.value)).toEqual([refs[2], refs[1]])
    expect(first.hasNext).toBe(true)
    expect(first.total).toBeUndefined()
    const second = await page(2)
    expect(second.rows.map((r) => r.id?.value)).toEqual([refs[0]])
    expect(second.hasNext).toBe(false)
  })

  it("counts the matching executions for the pager", async () => {
    const id = await unqueuedSchedule()
    await run(id)
    const result = await listExecutions(
      conductor,
      toListQuery({ sourceType: "schedule", period: "1h" }, nowSeconds() + 1, 1, 1),
    )
    expect(result.rows).toHaveLength(1)
    expect(result.total).toBeGreaterThanOrEqual(1)
    expect(result.hasNext).toBe(result.total! > 1)
  })
})

describe("one execution", () => {
  it("reads an execution and its status, the latest of its source too", async () => {
    const id = await unqueuedSchedule()
    const refId = await run(id)
    expect((await findExecution(conductor, refId))?.sourceId).toBe(id)
    expect(await statusOf(refId)).toBe(S.RESOLVED_EXECUTION_STATUS_ENQUEUE_FAILED)
    expect(
      (await findLatestStatusBySource(conductor, "schedule", id))?.executionRef?.id?.value,
    ).toBe(refId)
    expect(await findExecution(conductor, "1")).toBeUndefined()
  })

  it("deletes a finished execution once, and refuses one still running", async () => {
    const finished = await run(await unqueuedSchedule())
    expect(await deleteExecution(conductor, finished)).toBe(true)
    expect(await deleteExecution(conductor, finished)).toBe(false)

    const running = await run(await sleepingSchedule())
    const { executionRef } = await runningJob(running)
    cleanups.push(() => jw.job.delete({ value: executionRef!.jobId! }))
    const error = await deleteExecution(conductor, running).catch((err: unknown) => err)
    expect(classifyError(error)).toMatchObject({ code: Status.FAILED_PRECONDITION })
  }, 40_000)

  it("cancels a running job", async () => {
    const refId = await run(await sleepingSchedule())
    await runningJob(refId)
    expect(await cancelExecution(conductor, refId)).toBe(true)
    await vi.waitFor(
      async () => expect(await statusOf(refId)).toBe(S.RESOLVED_EXECUTION_STATUS_CANCELLED),
      WAIT,
    )
  }, 40_000)

  it("re-runs a schedule with its current settings, and not once it is gone", async () => {
    const id = await unqueuedSchedule()
    const first = await run(id)
    const again = await reExecute(conductor, first)
    expect(again).toMatchObject({ accepted: false })
    expect(again.refId).not.toBe(first)

    await deleteConfig(conductor, "schedules", id)
    const error = await reExecute(conductor, first).catch((err: unknown) => err)
    expect(classifyError(error)).toMatchObject({ code: Status.FAILED_PRECONDITION })
  })
})

describe("deleting a source's executions", () => {
  it("leaves running ones unless they are included", async () => {
    const id = await sleepingSchedule()
    const running = await run(id)
    const { executionRef } = await runningJob(running)
    cleanups.push(() => jw.job.delete({ value: executionRef!.jobId! }))
    // A command that does not exist fails at once: a finished execution.
    const finished = await run(id, JSON.stringify({ command: "it-no-such-command" }))
    await vi.waitFor(
      async () => expect(await statusOf(finished)).toBe(S.RESOLVED_EXECUTION_STATUS_FAILED),
      WAIT,
    )

    expect(await deleteExecutionsBySource(conductor, "schedule", id, false)).toBe(1)
    expect(await findExecution(conductor, finished)).toBeUndefined()
    expect(await findExecution(conductor, running)).toBeDefined()
    expect(await deleteExecutionsBySource(conductor, "schedule", id, true)).toBe(1)
    expect(await findExecution(conductor, running)).toBeUndefined()
  }, 40_000)
})
