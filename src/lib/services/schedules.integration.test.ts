// Schedules and running them now (triggerSchedule in ./executions).
// Requires a running conductor and jobworkerp with gRPC-Web enabled:
//   bash scripts/test-env.sh up
import { Status } from "nice-grpc-common"
import { afterEach, describe, expect, it } from "vitest"
import { createConductorClients, createJobworkerpClients } from "@/lib/clients"
import { findEntity } from "@/lib/entities"
import { classifyError } from "@/lib/errors"
import { WORKFLOW_TEMPLATE } from "@/lib/execution-target/definition"
import { nowSeconds } from "@/lib/format"
import { toScheduleData, toScheduleForm, type ScheduleFormValues } from "@/lib/schedules/form"
import { TEST_CONDUCTOR_URL, TEST_JOBWORKERP_URL } from "@/test/endpoints"
import { uniqueName } from "@/test/names"
import { inertScheduleForm } from "@/test/schedules"
import { localServerId } from "@/test/servers"
import { deleteWorkerByName } from "@/test/workers"
import { nextWorkflowInput } from "@/test/workflows"
import { createConfig, deleteConfig, listConfig, setConfigEnabled, updateConfig } from "./config"
import { triggerSchedule } from "./executions"
import { saveManagedWorkflow } from "./managed-workflows"

const conductor = createConductorClients(TEST_CONDUCTOR_URL)
const jw = createJobworkerpClients(TEST_JOBWORKERP_URL)
const cleanups: (() => Promise<unknown>)[] = []
afterEach(async () => {
  for (const cleanup of cleanups.splice(0).reverse()) await cleanup().catch(() => {})
})

async function values(overrides: Partial<ScheduleFormValues> = {}): Promise<ScheduleFormValues> {
  const serverId = await localServerId(conductor)
  return { ...inertScheduleForm(uniqueName("it-sched", "s"), serverId), ...overrides }
}

async function create(form: ScheduleFormValues) {
  const id = await createConfig(conductor, "schedules", toScheduleData(form, nowSeconds()))
  cleanups.push(() => deleteConfig(conductor, "schedules", id))
  return id
}

const stored = async (id: string) => findEntity(await listConfig(conductor, "schedules"), id)?.data

describe("schedules", () => {
  it("creates, updates, toggles and deletes a schedule", async () => {
    const form = await values({ crontab: "0 9 * * MON-FRI", description: "weekday mornings" })
    const id = await create(form)
    expect(await stored(id)).toMatchObject({
      crontab: "0 0 9 * * MON-FRI",
      description: "weekday mornings",
      enabled: false,
    })

    const data = (await stored(id))!
    await updateConfig(
      conductor,
      "schedules",
      id,
      toScheduleData({ ...form, crontab: "@daily" }, nowSeconds(), data.createdAt),
    )
    expect(await stored(id)).toMatchObject({ crontab: "@daily", createdAt: data.createdAt })

    await setConfigEnabled(conductor, "schedules", id, true, nowSeconds())
    expect((await stored(id))?.enabled).toBe(true)
    await setConfigEnabled(conductor, "schedules", id, false, nowSeconds())

    await deleteConfig(conductor, "schedules", id)
    expect(await stored(id)).toBeUndefined()
  })

  it("keeps the job timeout unset, zero or as given", async () => {
    for (const jobTimeoutSec of ["", "0", "90"]) {
      const form = await values({ jobTimeoutSec })
      const id = await create(form)
      expect(toScheduleForm((await stored(id))!).jobTimeoutSec, jobTimeoutSec).toBe(jobTimeoutSec)
    }
  })
})

describe("running a schedule now", () => {
  async function inlineSchedule(args: object) {
    const name = uniqueName("it-sched", "wf")
    await saveManagedWorkflow(jw, {
      name,
      kind: "schedule",
      settingName: name,
      definition: WORKFLOW_TEMPLATE,
      channel: "",
    })
    cleanups.push(() => deleteWorkerByName(jw, name))
    const form = await values({ name })
    // A disabled schedule: conductor still runs it on request.
    return create({
      ...form,
      target: {
        ...form.target,
        method: "workflowInline",
        managedWorkerName: name,
        definition: WORKFLOW_TEMPLATE,
        args: JSON.stringify(args),
      },
    }).then((id) => ({ id, name }))
  }

  it("sends the schedule's args to the workflow input, even while disabled", async () => {
    const { id, name } = await inlineSchedule({ from: "schedule" })
    let outcome: Awaited<ReturnType<typeof triggerSchedule>> | undefined
    const input = await nextWorkflowInput(jw, name, async () => {
      outcome = await triggerSchedule(conductor, id)
    })
    expect(input).toEqual({ from: "schedule" })
    expect(outcome).toMatchObject({ accepted: true, refId: expect.stringMatching(/^\d+$/) })
  }, 30_000)

  it("replaces the args for one run without merging or saving them", async () => {
    const { id, name } = await inlineSchedule({ from: "schedule", kept: true })
    const input = await nextWorkflowInput(jw, name, () =>
      triggerSchedule(conductor, id, JSON.stringify({ from: "override" })),
    )
    expect(input).toEqual({ from: "override" })
    expect(JSON.parse((await stored(id))!.args!)).toEqual({ from: "schedule", kept: true })
  }, 30_000)

  it("reports a job that could not be enqueued", async () => {
    const id = await create(
      await values({
        target: {
          ...(await values()).target,
          workerName: uniqueName("it-sched", "missing-worker"),
        },
      }),
    )
    const outcome = await triggerSchedule(conductor, id)
    expect(outcome).toMatchObject({ accepted: false, refId: expect.stringMatching(/^\d+$/) })
    if (!outcome.accepted) expect(outcome.error).toMatch(/.+/)
  })

  it("fails for a schedule that does not exist", async () => {
    const error = await triggerSchedule(conductor, "1").catch((err: unknown) => err)
    expect(classifyError(error)).toMatchObject({ kind: "status", code: Status.NOT_FOUND })
  })
})
