// Requires a running jobworkerp with gRPC-Web enabled: bash scripts/test-env.sh up
import { describe, expect, it } from "vitest"
import { createJobworkerpClients } from "@/lib/clients"
import { classifyError } from "@/lib/errors"
import { WORKFLOW_RUNNER_NAME } from "@/lib/execution-target/workflow-settings"
import { TEST_JOBWORKERP_URL } from "@/test/endpoints"
import {
  fetchJobworkerpInfo,
  findRunner,
  findRunnerByName,
  listChannels,
  searchWorkers,
} from "./jobworkerp"

const reachable = createJobworkerpClients(TEST_JOBWORKERP_URL)

describe("jobworkerp service", () => {
  it("summarizes a reachable server", async () => {
    const info = await fetchJobworkerpInfo(reachable)
    expect(info.workerCount).toBeGreaterThan(0)
    expect(info.channels.reduce((sum, c) => sum + c.workerCount, 0)).toBe(info.workerCount)
    expect(info.jobs.total).toBeGreaterThanOrEqual(0)
  })

  it("reports an unreachable server as a network error", async () => {
    const error = await fetchJobworkerpInfo(createJobworkerpClients("http://127.0.0.1:9")).catch(
      (e: unknown) => e,
    )
    expect(classifyError(error).kind).toBe("network")
  })

  it("searches workers by name prefix", async () => {
    // bootstrap registers the conductor-admin workers in the all-in-one image.
    const all = await searchWorkers(reachable, "")
    expect(all.length).toBeGreaterThan(0)
    const name = all[0].data!.name
    const found = await searchWorkers(reachable, name.slice(0, 3))
    expect(found.every((w) => w.data!.name.startsWith(name.slice(0, 3)))).toBe(true)
    expect(found.map((w) => w.data!.name)).toContain(name)
    expect(await searchWorkers(reachable, "no-such-worker-prefix-")).toEqual([])
  })

  it("finds names containing _ although jobworkerp's filter misses them on SQLite", async () => {
    // bootstrap registers "conductor_cron-scheduler_*" workers in the all-in-one image.
    const found = await searchWorkers(reachable, "conductor_cron-scheduler_")
    expect(found.length).toBeGreaterThan(0)
    expect(found.every((w) => w.data!.name.startsWith("conductor_cron-scheduler_"))).toBe(true)
  })

  it("finds a runner by id", async () => {
    const byName = await findRunnerByName(reachable, WORKFLOW_RUNNER_NAME)
    expect((await findRunner(reachable, byName!.id!.value))?.data?.name).toBe(WORKFLOW_RUNNER_NAME)
    expect(await findRunner(reachable, "999999999")).toBeUndefined()
  })

  it("lists the named job channels, leaving out the default one", async () => {
    // scripts/test-env.sh adds "batch" to the default channel.
    expect(await listChannels(reachable)).toEqual(["batch"])
  })

  it("finds the WORKFLOW runner with its settings schema", async () => {
    const runner = await findRunnerByName(reachable, WORKFLOW_RUNNER_NAME)
    expect(runner?.data?.runnerSettingsProto).toContain("message")
    expect(await findRunnerByName(reachable, "NO_SUCH_RUNNER")).toBeUndefined()
  })
})
