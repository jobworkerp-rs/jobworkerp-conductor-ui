import { describe, expect, it } from "vitest"
import type { ConfigDataByKind, ConfigEntity } from "@/lib/services/config"
import {
  countReferencesByKind,
  countReferencesByServer,
  findServerReferences,
  groupReferencesByKind,
  type ConfigSnapshot,
} from "./references"

const sid = (value: string) => ({ value })

function schedule(
  id: string,
  name: string,
  server: string,
  enabled = true,
): ConfigEntity<"schedules"> {
  return {
    id,
    data: { name, jobworkerpServerId: sid(server), enabled } as ConfigDataByKind["schedules"],
  }
}

function slack(
  id: string,
  name: string,
  server: string,
  enabled = true,
): ConfigEntity<"slackHandlers"> {
  return {
    id,
    data: { name, jobworkerpServerId: sid(server), enabled } as ConfigDataByKind["slackHandlers"],
  }
}

function result(
  id: string,
  name: string,
  listen: string,
  process: string,
  enabled = true,
): ConfigEntity<"resultHandlers"> {
  return {
    id,
    data: {
      name,
      listenJobworkerpServerId: sid(listen),
      processJobworkerpServerId: sid(process),
      enabled,
    } as ConfigDataByKind["resultHandlers"],
  }
}

const snapshot: ConfigSnapshot = {
  schedules: [schedule("1", "daily", "10"), schedule("2", "other", "20", false)],
  slackHandlers: [slack("3", "summarize", "10")],
  resultHandlers: [
    result("4", "watch-10", "10", "20"),
    result("5", "run-on-10", "20", "10"),
    result("6", "both-10", "10", "10", false),
  ],
}

describe("findServerReferences", () => {
  it("lists every kind, counting both sides of result handlers", () => {
    expect(findServerReferences("10", snapshot)).toEqual([
      { kind: "schedule", id: "1", name: "daily", roles: ["target"], enabled: true },
      { kind: "slackHandler", id: "3", name: "summarize", roles: ["target"], enabled: true },
      { kind: "resultHandler", id: "4", name: "watch-10", roles: ["listen"], enabled: true },
      { kind: "resultHandler", id: "5", name: "run-on-10", roles: ["process"], enabled: true },
      {
        kind: "resultHandler",
        id: "6",
        name: "both-10",
        roles: ["listen", "process"],
        enabled: false,
      },
    ])
  })

  it("returns nothing for an unreferenced server", () => {
    expect(findServerReferences("99", snapshot)).toEqual([])
  })
})

describe("countReferencesByServer", () => {
  it("counts each configuration once per server", () => {
    const counts = countReferencesByServer(snapshot)
    expect(counts.get("10")).toBe(5)
    expect(counts.get("20")).toBe(3)
    expect(counts.get("99")).toBeUndefined()
  })
})

describe("countReferencesByKind", () => {
  it("counts every kind, zero included", () => {
    expect(countReferencesByKind(findServerReferences("10", snapshot))).toEqual({
      schedule: 1,
      slackHandler: 1,
      resultHandler: 3,
    })
    expect(countReferencesByKind([])).toEqual({ schedule: 0, slackHandler: 0, resultHandler: 0 })
  })
})

describe("groupReferencesByKind", () => {
  it("groups names by kind in a fixed order and skips empty kinds", () => {
    expect(groupReferencesByKind(findServerReferences("10", snapshot))).toEqual([
      { kind: "schedule", names: ["daily"] },
      { kind: "slackHandler", names: ["summarize"] },
      { kind: "resultHandler", names: ["watch-10", "run-on-10", "both-10"] },
    ])
    expect(groupReferencesByKind([])).toEqual([])
  })
})
