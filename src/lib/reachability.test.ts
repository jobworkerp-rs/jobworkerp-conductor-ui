import { ClientError, Status } from "nice-grpc-common"
import { describe, expect, it } from "vitest"
import { reachabilityOf, summarizeReachability } from "./reachability"

describe("reachabilityOf", () => {
  it("is not configured without browser-side clients", () => {
    expect(reachabilityOf({ configured: false, pending: true, error: null })).toBe("notConfigured")
  })

  it("is checking until the first answer", () => {
    expect(reachabilityOf({ configured: true, pending: true, error: null })).toBe("checking")
  })

  it("is reachable after a reply", () => {
    expect(reachabilityOf({ configured: true, pending: false, error: null })).toBe("reachable")
  })

  it("is unreachable when no gRPC reply came back", () => {
    const transport = new ClientError("/x", Status.UNKNOWN, "Transport error: fetch failed")
    const http = new ClientError("/x", Status.UNKNOWN, "Received HTTP 502 response: Bad Gateway")
    for (const error of [transport, http]) {
      expect(reachabilityOf({ configured: true, pending: false, error })).toBe("unreachable")
    }
  })

  it("is reachable when the server answered with an error status", () => {
    const error = new ClientError("/x", Status.UNIMPLEMENTED, "no such method")
    expect(reachabilityOf({ configured: true, pending: false, error })).toBe("reachable")
  })
})

describe("summarizeReachability", () => {
  it("has nothing to say without a linked server", () => {
    expect(summarizeReachability([])).toBe("none")
  })

  it("is checking while any server has yet to answer", () => {
    expect(summarizeReachability(["reachable", "checking", "unreachable"])).toBe("checking")
  })

  it("counts the reachable out of the linked once all have answered", () => {
    expect(summarizeReachability(["reachable", "unreachable", "reachable"])).toEqual({
      reachable: 2,
      linked: 3,
    })
  })
})
