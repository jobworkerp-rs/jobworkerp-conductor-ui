// Requires a running conductor and jobworkerp with gRPC-Web enabled:
//   bash scripts/test-env.sh up
import { describe, expect, it } from "vitest"
import { createConductorClients, createJobworkerpClients } from "./clients"
import {
  TEST_CONDUCTOR_URL as CONDUCTOR_URL,
  TEST_JOBWORKERP_URL as JOBWORKERP_URL,
} from "@/test/endpoints"
import { classifyError } from "./errors"

describe("conductor clients", () => {
  it("counts cron schedulers over gRPC-Web", async () => {
    const { cronScheduler } = createConductorClients(CONDUCTOR_URL)
    const response = await cronScheduler.count({})
    expect(Number(response.total)).toBeGreaterThanOrEqual(0)
  })

  it("reaches every conductor service", async () => {
    const clients = createConductorClients(CONDUCTOR_URL)
    await expect(clients.jobworkerpServer.count({})).resolves.toBeDefined()
    await expect(clients.slackEventHandler.count({})).resolves.toBeDefined()
    await expect(clients.workerResultHandler.count({})).resolves.toBeDefined()
    await expect(clients.executionStatus.countList({})).resolves.toBeDefined()
    await expect(
      clients.configManagement.validateConfig({
        tomlContent: "",
        overwriteExisting: false,
        validateOnly: true,
      }),
    ).resolves.toBeDefined()
  })

  it("reports an unreachable endpoint as a network error", async () => {
    const { cronScheduler } = createConductorClients("http://127.0.0.1:9")
    const error = await cronScheduler.count({}).catch((e: unknown) => e)
    expect(classifyError(error).kind).toBe("network")
  })
})

describe("jobworkerp clients", () => {
  it("counts workers over gRPC-Web", async () => {
    const { worker } = createJobworkerpClients(JOBWORKERP_URL)
    const response = await worker.count({})
    expect(Number(response.total)).toBeGreaterThanOrEqual(0)
  })

  it("lists runners", async () => {
    const { runner } = createJobworkerpClients(JOBWORKERP_URL)
    const names: string[] = []
    for await (const r of runner.findList({})) names.push(r.data?.name ?? "")
    expect(names).toContain("WORKFLOW")
  })
})
