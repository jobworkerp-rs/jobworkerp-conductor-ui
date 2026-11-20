import { describe, expect, it } from "vitest"
import { interpretStoredTarget } from "./stored"

const link = { name: "local", grpcWebUrl: "http://jw" }
const base = { serverId: "1", link, linked: true }

describe("interpretStoredTarget", () => {
  it("is ready at once for new settings and targets without a worker", () => {
    expect(interpretStoredTarget({ ...base, workerName: undefined, lookup: undefined })).toEqual({
      ready: true,
      managedWorkerMissing: false,
    })
  })

  it("waits for the lookup of a worker target", () => {
    expect(interpretStoredTarget({ ...base, workerName: "w", lookup: undefined }).ready).toBe(false)
  })

  it("cannot check without a link and then treats the worker as a plain one", () => {
    expect(
      interpretStoredTarget({
        ...base,
        linked: false,
        workerName: "conductor-result-x",
        lookup: undefined,
      }),
    ).toEqual({ ready: true, managedWorkerMissing: false })
  })

  it("reads a managed worker's definition back as an inline target", () => {
    expect(
      interpretStoredTarget({
        ...base,
        workerName: "w",
        lookup: { status: "found", definition: "do: []", channel: "batch" },
      }),
    ).toEqual({
      ready: true,
      managed: { definition: "do: []", channel: "batch" },
      managedWorkerMissing: false,
      previous: { serverId: "1", workerName: "w", link },
    })
  })

  it("keeps a missing managed-looking worker inline, with a warning, so saving recreates it", () => {
    expect(
      interpretStoredTarget({
        ...base,
        workerName: "conductor-result-x",
        lookup: { status: "missing" },
      }),
    ).toEqual({
      ready: true,
      managed: { definition: "", channel: "" },
      managedWorkerMissing: true,
      previous: { serverId: "1", workerName: "conductor-result-x", link },
    })
  })

  it("treats other workers as registered workers", () => {
    for (const lookup of [{ status: "missing" as const }, { status: "notManaged" as const }]) {
      expect(interpretStoredTarget({ ...base, workerName: "summarize", lookup })).toEqual({
        ready: true,
        managedWorkerMissing: false,
      })
    }
  })
})
