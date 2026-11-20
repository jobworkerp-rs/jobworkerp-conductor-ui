import { describe, expect, it } from "vitest"
import { createRuntimeClients } from "./clients"

describe("createRuntimeClients", () => {
  it("creates jobworkerp clients only for servers reachable from the browser", () => {
    const clients = createRuntimeClients({
      conductorUrl: "http://conductor",
      jobworkerpServers: [
        { name: "with-url", grpcWebUrl: "http://jobworkerp" },
        { name: "link-only", adminUiUrl: "http://admin-ui" },
      ],
    })
    expect([...clients.jobworkerp.keys()]).toEqual(["with-url"])
    expect(clients.conductor.cronScheduler).toBeDefined()
  })
})
