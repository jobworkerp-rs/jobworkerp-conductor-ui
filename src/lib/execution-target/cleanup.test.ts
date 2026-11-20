import { describe, expect, it } from "vitest"
import {
  managedWorkerOf,
  obsoleteManagedWorker,
  sameJobworkerp,
  type ManagedWorkerRef,
} from "./cleanup"
import { EXECUTION_TARGET_DEFAULTS } from "./form"

const ref = (serverId: string, workerName: string, grpcWebUrl?: string): ManagedWorkerRef => ({
  serverId,
  workerName,
  link: { name: `server-${serverId}`, grpcWebUrl },
})

describe("obsoleteManagedWorker", () => {
  it("is nothing when no managed worker was in use", () => {
    expect(obsoleteManagedWorker(undefined, ref("1", "w"))).toBeUndefined()
  })

  it("is the old worker when the setting is deleted or stops using an inline definition", () => {
    expect(obsoleteManagedWorker(ref("1", "w"), undefined)).toEqual(ref("1", "w"))
  })

  it("is nothing when the same worker stays in use", () => {
    expect(obsoleteManagedWorker(ref("1", "w"), ref("1", "w"))).toBeUndefined()
  })

  it("is the old worker after a rename", () => {
    expect(obsoleteManagedWorker(ref("1", "old"), ref("1", "new"))).toEqual(ref("1", "old"))
  })

  it("is the old worker after moving to another jobworkerp", () => {
    expect(obsoleteManagedWorker(ref("1", "w", "http://a"), ref("2", "w", "http://b"))).toEqual(
      ref("1", "w", "http://a"),
    )
  })

  it("is nothing when both servers reach the same jobworkerp, where it is the same worker", () => {
    expect(
      obsoleteManagedWorker(ref("1", "w", "http://a"), ref("2", "w", "http://a")),
    ).toBeUndefined()
  })
})

describe("sameJobworkerp", () => {
  it("treats servers with the same browser URL as one jobworkerp", () => {
    expect(
      sameJobworkerp(
        { name: "a", grpcWebUrl: "http://jw:9000" },
        { name: "b", grpcWebUrl: "http://jw:9000" },
      ),
    ).toBe(true)
    expect(
      sameJobworkerp(
        { name: "a", grpcWebUrl: "http://jw:9000" },
        { name: "b", grpcWebUrl: "http://other:9000" },
      ),
    ).toBe(false)
  })

  it("cannot tell without browser URLs", () => {
    expect(sameJobworkerp({ name: "a" }, { name: "b", grpcWebUrl: "http://jw:9000" })).toBe(false)
    expect(sameJobworkerp(undefined, undefined)).toBe(false)
  })
})

describe("managedWorkerOf", () => {
  it("names the managed worker of an inline target and nothing otherwise", () => {
    const link = { name: "local", grpcWebUrl: "http://jw" }
    const form = { ...EXECUTION_TARGET_DEFAULTS, serverId: "1", managedWorkerName: " w " }
    expect(managedWorkerOf({ ...form, method: "workflowInline" }, link)).toEqual({
      serverId: "1",
      workerName: "w",
      link,
    })
    expect(managedWorkerOf({ ...form, method: "worker" }, link)).toBeUndefined()
  })
})
