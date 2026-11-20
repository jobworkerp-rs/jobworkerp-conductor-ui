import { describe, expect, it } from "vitest"
import {
  SERVER_FORM_DEFAULTS,
  isValidHost,
  serverEndpoint,
  toServerData,
  toServerForm,
  validateServerForm,
  type ServerFormValues,
} from "./form"

const RANGE = { key: "servers.form.errors.portRange" }

const valid: ServerFormValues = {
  name: "prod-main",
  host: "jobworkerp",
  port: "9000",
  sslEnabled: false,
  description: "",
  enabled: true,
}

describe("validateServerForm", () => {
  it("accepts valid values", () => {
    expect(validateServerForm(valid)).toEqual({})
  })

  it("defaults to port 9000, no SSL, enabled", () => {
    expect(SERVER_FORM_DEFAULTS).toMatchObject({ port: "9000", sslEnabled: false, enabled: true })
  })

  it.each([
    ["0", RANGE],
    ["1", undefined],
    ["65535", undefined],
    ["65536", RANGE],
    ["", { key: "common.formErrors.required" }],
    ["90a0", RANGE],
    ["-1", RANGE],
    ["9000.5", RANGE],
    [" 9000 ", undefined],
    ["9 000", RANGE],
  ])("port %j → %s", (port, error) => {
    expect(validateServerForm({ ...valid, port }).port).toEqual(error)
  })

  it("checks the name and description with the shared rules", () => {
    expect(validateServerForm({ ...valid, name: " " }).name).toEqual({
      key: "common.formErrors.required",
    })
    expect(validateServerForm({ ...valid, description: "x".repeat(501) }).description).toEqual({
      key: "common.formErrors.tooLong",
      values: { max: 500 },
    })
  })

  it("requires a host", () => {
    expect(validateServerForm({ ...valid, host: "" }).host).toEqual({
      key: "common.formErrors.required",
    })
    expect(validateServerForm({ ...valid, host: "not a host" }).host).toEqual({
      key: "servers.form.errors.invalidHost",
    })
  })
})

describe("isValidHost", () => {
  it.each([
    "localhost",
    "jobworkerp",
    "jobworkerp.internal.example.com",
    "my_service",
    "10.0.0.1",
    "[::1]",
    "[2001:db8::1]",
    "JobWorkerp",
  ])("accepts %s", (host) => {
    expect(isValidHost(host)).toBe(true)
  })

  it.each([
    ["an empty string", ""],
    ["whitespace", "my host"],
    ["a scheme", "http://host"],
    ["a port", "host:9000"],
    ["a path", "host/path"],
    ["user info", "user@host"],
    ["a bare IPv6 address (conductor joins host and port with ':')", "::1"],
    ["an out-of-range IPv4 address", "999.1.1.1"],
    ["a shortened IPv4 address", "10.1"],
    ["a percent-encoded name", "%6Cocalhost"],
  ])("rejects %s", (_label, host) => {
    expect(isValidHost(host)).toBe(false)
  })
})

describe("toServerData / toServerForm", () => {
  it("trims text, normalizes the port and stamps both times on create", () => {
    expect(
      toServerData(
        { ...valid, name: " prod ", host: " jw ", port: " 09000 ", description: "  " },
        1_700_000_000,
      ),
    ).toEqual({
      name: "prod",
      host: "jw",
      port: "9000",
      sslEnabled: false,
      description: undefined,
      enabled: true,
      createdAt: "1700000000",
      updatedAt: "1700000000",
    })
  })

  it("keeps created_at on update", () => {
    const data = toServerData({ ...valid, description: "main" }, 1_800_000_000, "1700000000")
    expect(data).toMatchObject({
      createdAt: "1700000000",
      updatedAt: "1800000000",
      description: "main",
    })
  })

  it("round-trips through the form", () => {
    const data = toServerData({ ...valid, sslEnabled: true, description: "d" }, 1)
    expect(toServerForm(data)).toEqual({ ...valid, sslEnabled: true, description: "d" })
  })
})

describe("serverEndpoint", () => {
  it("shows the URL conductor connects to", () => {
    expect(serverEndpoint({ host: "jw", port: "9000", sslEnabled: false })).toBe("http://jw:9000")
    expect(serverEndpoint({ host: "[::1]", port: "443", sslEnabled: true })).toBe(
      "https://[::1]:443",
    )
  })
})
