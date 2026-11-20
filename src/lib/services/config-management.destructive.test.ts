// Clears and overwrites every setting, so it runs against a conductor of its
// own (the "clear" environment of scripts/test-env.sh), never the shared one.
import { beforeEach, describe, expect, it } from "vitest"
import { createConductorClients, createJobworkerpClients } from "@/lib/clients"
import { TEST_CLEAR_CONDUCTOR_URL, TEST_CLEAR_JOBWORKERP_URL } from "@/test/endpoints"
import { createSleepWorker, deleteWorkerByName, sleepArgs } from "@/test/workers"
import { listConfig } from "./config"
import { clearAllSettings, exportConfig, importConfig } from "./config-management"
import { findLatestStatusBySource } from "./executions"
import { findWorkerByName } from "./jobworkerp"
import { saveManagedWorkflow } from "./managed-workflows"

const conductor = createConductorClients(TEST_CLEAR_CONDUCTOR_URL)
const jobworkerp = createJobworkerpClients(TEST_CLEAR_JOBWORKERP_URL)

// The container's own jobworkerp, as conductor inside it reaches it.
const SERVER = `
[[jobworkerp]]
name = "local"
address = "http://127.0.0.1:9000"
`

const EVERY_KIND = `${SERVER}
description = "bundled"

[[jobworkerp]]
name = "spare"
address = "https://spare.invalid:9443"
enabled = false

[[schedulers]]
name = "nightly"
jobworkerp = "local"
crontab = "0 0 3 * * *"
worker_name = "report"
description = "nightly report"

[[listeners]]
name = "follow-up"
jobworkerp = "local"
listen_jobworkerp = "spare"
listen_worker_name = "source"
worker_name = "after"
enabled = false

[[slack_handlers]]
name = "deploy"
jobworkerp = "local"
message_pattern = "^deploy"
worker_name = "deployer"
description = "deploy on request"
enabled = false
`

beforeEach(async () => {
  await clearAllSettings(conductor, [])
})

describe("config management, clearing and overwriting", () => {
  it("restores every kind with descriptions and enabled state after a clear", async () => {
    expect((await importConfig(conductor, EVERY_KIND, true)).ok).toBe(true)
    const exported = (await exportConfig(conductor, false)).toml

    await clearAllSettings(conductor, [])
    for (const kind of ["servers", "schedules", "slackHandlers", "resultHandlers"] as const) {
      expect(await listConfig(conductor, kind)).toEqual([])
    }

    const restored = await importConfig(conductor, exported, false)
    expect(restored).toEqual({
      ok: true,
      counts: { servers: 2, schedules: 1, resultHandlers: 1, slackHandlers: 1 },
      errors: [],
    })
    expect((await exportConfig(conductor, false)).toml).toBe(exported)
    const [deploy] = await listConfig(conductor, "slackHandlers")
    expect(deploy?.data).toMatchObject({ description: "deploy on request", enabled: false })
  })

  it("runs an imported schedule without restarting conductor", async () => {
    const worker = "ui-destructive-sleep"
    await deleteWorkerByName(jobworkerp, worker)
    await createSleepWorker(jobworkerp, worker)
    try {
      const everySecond = `${SERVER}
[[schedulers]]
name = "every-second"
jobworkerp = "local"
crontab = "* * * * * *"
worker_name = "${worker}"
args = '${sleepArgs(0)}'
`
      expect((await importConfig(conductor, everySecond, true)).ok).toBe(true)
      const [schedule] = await listConfig(conductor, "schedules")
      await expect
        .poll(() => findLatestStatusBySource(conductor, "schedule", schedule!.id), {
          timeout: 15_000,
        })
        .toBeDefined()
    } finally {
      await clearAllSettings(conductor, [])
      await deleteWorkerByName(jobworkerp, worker)
    }
  })

  it("deletes the managed workers it is given and keeps the rest", async () => {
    const managed = "conductor-schedule-destructive-managed"
    const kept = "conductor-schedule-destructive-kept"
    for (const name of [managed, kept]) {
      await deleteWorkerByName(jobworkerp, name)
      await saveManagedWorkflow(jobworkerp, {
        name,
        kind: "schedule",
        settingName: name,
        definition:
          "document:\n  dsl: 1.0.0\n  namespace: t\n  name: t\n  version: 0.0.1\ndo: []\n",
        channel: "",
      })
    }
    try {
      const outcome = await clearAllSettings(conductor, [
        { clients: jobworkerp, workerName: managed },
      ])
      expect(outcome.failedWorkers).toEqual([])
      expect(await findWorkerByName(jobworkerp, managed)).toBeUndefined()
      expect(await findWorkerByName(jobworkerp, kept)).toBeDefined()
    } finally {
      await deleteWorkerByName(jobworkerp, managed)
      await deleteWorkerByName(jobworkerp, kept)
    }
  })
})
