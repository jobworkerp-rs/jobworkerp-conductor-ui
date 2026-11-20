import { ClientError, Status } from "nice-grpc-common"
import { describe, expect, it } from "vitest"
import en from "@/locales/en/translation.json"
import ja from "@/locales/ja/translation.json"
import { AppError, classifyError } from "./errors"

const PATH = "/jobworkerp_conductor.service.CronSchedulerService/Count"

function lookup(catalog: unknown, key: string): unknown {
  return key
    .split(".")
    .reduce<unknown>(
      (node, part) =>
        node && typeof node === "object" ? (node as Record<string, unknown>)[part] : undefined,
      catalog,
    )
}

const statusCodes = Object.values(Status).filter(
  (v): v is Status => typeof v === "number" && v !== Status.OK,
)

describe("classifyError", () => {
  it.each(statusCodes)("maps status %s to a message present in both catalogs", (code) => {
    const result = classifyError(new ClientError(PATH, code, "server says no"))
    expect(result.kind).toBe("status")
    expect(result.code).toBe(code)
    expect(typeof lookup(ja, result.messageKey)).toBe("string")
    expect(typeof lookup(en, result.messageKey)).toBe("string")
  })

  it("keeps the server message so INTERNAL validation errors stay readable", () => {
    const result = classifyError(
      new ClientError(PATH, Status.INTERNAL, "other error: invalid regex pattern"),
    )
    expect(result).toMatchObject({
      kind: "status",
      messageKey: "errors.status.internal",
      serverMessage: "other error: invalid regex pattern",
    })
  })

  it("explains UNIMPLEMENTED as an outdated conductor", () => {
    expect(classifyError(new ClientError(PATH, Status.UNIMPLEMENTED, "")).messageKey).toBe(
      "errors.status.unimplemented",
    )
  })

  it("falls back for a status code outside the known set", () => {
    const result = classifyError(new ClientError(PATH, 99 as Status, "?"))
    expect(result.messageKey).toBe("errors.status.default")
  })

  it("tells a transport failure apart from an UNAVAILABLE reply", () => {
    const transport = classifyError(
      new ClientError(PATH, Status.UNKNOWN, "Transport error: TypeError: Failed to fetch"),
    )
    const unavailable = classifyError(new ClientError(PATH, Status.UNAVAILABLE, "db error: ..."))
    expect(transport).toMatchObject({ kind: "network", messageKey: "errors.network" })
    expect(unavailable).toMatchObject({ kind: "status", messageKey: "errors.status.unavailable" })
  })

  it("reports a non-gRPC HTTP reply with its status code", () => {
    const result = classifyError(
      new ClientError(PATH, Status.UNIMPLEMENTED, "Received HTTP 404 response: Not Found"),
    )
    expect(result).toMatchObject({
      kind: "http",
      httpStatus: 404,
      messageKey: "errors.http",
      messageValues: { status: 404 },
    })
  })

  it("recognises aborted calls", () => {
    expect(classifyError(new DOMException("aborted", "AbortError"))).toMatchObject({
      kind: "aborted",
    })
  })

  it("wraps anything else as unknown", () => {
    expect(classifyError(new Error("boom"))).toMatchObject({
      kind: "unknown",
      messageKey: "errors.unknown",
      serverMessage: "boom",
    })
    expect(classifyError("string thrown")).toMatchObject({ kind: "unknown" })
  })
})

describe("AppError", () => {
  it("carries its own message key and values", () => {
    const error = new AppError("errors.app.example", { name: "w" })
    expect(classifyError(error)).toEqual({
      kind: "app",
      messageKey: "errors.app.example",
      messageValues: { name: "w" },
    })
  })

  it("passes on the detail of the error that caused it", () => {
    const cause = new ClientError("/x", Status.UNAVAILABLE, "jobworkerp down")
    expect(classifyError(new AppError("errors.app.example", {}, cause)).serverMessage).toBe(
      "jobworkerp down",
    )
  })
})
