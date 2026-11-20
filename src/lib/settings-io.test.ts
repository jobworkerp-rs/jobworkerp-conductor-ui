import { describe, expect, it } from "vitest"
import type { ConfigDataByKind, ConfigEntity } from "@/lib/services/config"
import type { ImportResult } from "@/lib/services/config-management"
import type { ConfigSnapshot } from "@/lib/servers/references"
import {
  canImport,
  classifyWorkerTargets,
  exportFileName,
  isCurrent,
  uniqueWorkers,
  workerTargets,
  type WorkerTarget,
} from "./settings-io"

const server = (value: string) => ({ value })

const snapshot: ConfigSnapshot = {
  schedules: [
    {
      id: "1",
      data: {
        name: "inline",
        jobworkerpServerId: server("10"),
        worker: { workerName: "conductor-schedule-inline", using: "run" },
      } as ConfigDataByKind["schedules"],
    },
    {
      id: "2",
      data: {
        name: "by-url",
        jobworkerpServerId: server("10"),
        workflow: { workflowUrl: "https://example.com/wf.yml" },
      } as ConfigDataByKind["schedules"],
    },
  ],
  slackHandlers: [
    {
      id: "3",
      data: {
        name: "deploy",
        jobworkerpServerId: server("20"),
        worker: { workerName: "deployer" },
      } as ConfigDataByKind["slackHandlers"],
    },
  ],
  resultHandlers: [
    {
      id: "4",
      data: {
        name: "follow-up",
        listenJobworkerpServerId: server("10"),
        processJobworkerpServerId: server("20"),
        worker: { workerName: "after" },
      } as ConfigDataByKind["resultHandlers"],
    } as ConfigEntity<"resultHandlers">,
  ],
}

describe("workerTargets", () => {
  it("lists the settings that run a worker, on the server that runs it", () => {
    expect(workerTargets(snapshot)).toEqual([
      {
        kind: "schedule",
        id: "1",
        name: "inline",
        serverId: "10",
        workerName: "conductor-schedule-inline",
      },
      { kind: "slackHandler", id: "3", name: "deploy", serverId: "20", workerName: "deployer" },
      { kind: "resultHandler", id: "4", name: "follow-up", serverId: "20", workerName: "after" },
    ])
  })

  it("is empty when no setting runs a worker", () => {
    expect(workerTargets({ schedules: [], slackHandlers: [], resultHandlers: [] })).toEqual([])
  })
})

describe("classifyWorkerTargets", () => {
  const target = (id: string, workerName: string): WorkerTarget => ({
    kind: "schedule",
    id,
    name: id,
    serverId: "10",
    workerName,
  })
  const managedName = "conductor-schedule-a"

  it("keeps the managed, and the unchecked ones named like managed workers", () => {
    const verdicts: Record<string, boolean | undefined> = {
      checked: true,
      other: false,
      // Looked up and not managed, despite the name: left out.
      lookalike: false,
      unchecked: undefined,
      plain: undefined,
    }
    const targets = [
      target("checked", "custom"),
      target("other", "custom"),
      target("lookalike", managedName),
      target("unchecked", managedName),
      target("plain", "custom"),
    ]
    const { managed, unverified } = classifyWorkerTargets(targets, (t) => verdicts[t.id])
    expect(managed.map((t) => t.id)).toEqual(["checked"])
    expect(unverified.map((t) => t.id)).toEqual(["unchecked"])
  })
})

describe("uniqueWorkers", () => {
  it("names each worker once per server", () => {
    expect(
      uniqueWorkers([
        { serverId: "10", workerName: "a" },
        { serverId: "10", workerName: "a" },
        { serverId: "20", workerName: "a" },
      ]),
    ).toEqual([
      { serverId: "10", workerName: "a" },
      { serverId: "20", workerName: "a" },
    ])
  })
})

describe("exportFileName", () => {
  it("stamps the local date and time", () => {
    expect(exportFileName(new Date(2026, 10, 19, 8, 5, 3))).toBe(
      "conductor-settings-20261119-080503.toml",
    )
  })
})

describe("isCurrent", () => {
  it("matches only the content and choice that were validated", () => {
    const counts = { servers: 0, schedules: 0, resultHandlers: 0, slackHandlers: 0 }
    const result = { ok: false, counts, errors: ["x"] }
    expect(isCurrent(undefined, "a", false)).toBe(false)
    expect(isCurrent({ toml: "a", overwrite: false, result }, "a", false)).toBe(true)
    expect(isCurrent({ toml: "a", overwrite: false, result }, "a", true)).toBe(false)
  })
})

describe("canImport", () => {
  const ok: ImportResult = {
    ok: true,
    counts: { servers: 1, schedules: 0, resultHandlers: 0, slackHandlers: 0 },
    errors: [],
  }

  it("needs a passing validation of exactly what would be imported", () => {
    const validated = { toml: "a", overwrite: false, result: ok }
    expect(canImport(undefined, "a", false)).toBe(false)
    expect(canImport(validated, "a", false)).toBe(true)
    expect(canImport(validated, "a ", false)).toBe(false)
    expect(canImport(validated, "a", true)).toBe(false)
    expect(
      canImport({ ...validated, result: { ...ok, ok: false, errors: ["x"] } }, "a", false),
    ).toBe(false)
  })
})
